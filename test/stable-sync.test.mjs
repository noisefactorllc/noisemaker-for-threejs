import assert from 'node:assert/strict'
import test from 'node:test'
import { OneFactor, ZeroFactor } from 'three'
import { bootEngine } from '../vendor/engine.mjs'

const { core, compileGraph, Pipeline, Backend } = await bootEngine()

test('element ids round-trip without becoming shader uniforms', () => {
  for (const argumentsText of ['#336699, 1, _id: "color"', '_id: "color", #336699, 1']) {
    const source = `search synth\nsolid(${argumentsText}).write(o0, _id: "output")\nrender(o0)`
    const compiled = core.compile(source)
    assert.deepEqual(compiled.diagnostics, [])
    assert.equal(compiled.plans[0].chain[0].args._id, 'color')
    assert.equal(compiled.plans[0].chain[1].args._id, 'output')
    const again = core.compile(core.unparse(compiled))
    assert.deepEqual(again.diagnostics, [])
    assert.deepEqual(again.plans[0].chain.map(step => step.args), compiled.plans[0].chain.map(step => step.args))
    for (const pass of compileGraph(source).passes) assert.ok(!Object.hasOwn(pass.uniforms || {}, '_id'))
  }
})

test('stored positional colors retain indexed binding under keyword overrides', () => {
  core.registerOp('user.rgb', { name: 'rgb', args: ['r', 'g', 'b'].map(name => ({ name, type: 'float', default: 0 })) })
  core.registerStarterOps(['user.rgb'])
  const compiled = core.compile('search user\nlet color = rgb(#804020)\ncolor(r: 0.25).write(o0)')
  assert.deepEqual(compiled.diagnostics, [])
  const args = compiled.plans[0].chain.find(step => step.op === 'user.rgb').args
  assert.equal(args.r, 0.25)
  assert.equal(args.g, 64 / 255)
  assert.equal(args.b, 32 / 255)
})

test('call comments and surplus positional diagnostics retain source positions', () => {
  const compiled = core.compile('search synth\nsolid(\n// channels\n#123456, 1, 99).write(o0)')
  const extra = compiled.diagnostics.find(d => d.code === 'S009')
  assert.ok(extra)
  assert.deepEqual(extra.location, { line: 4, column: 13 })
})

test('normalized frame deltas include the frame after zero and loop wrap', () => {
  const backend = new Backend()
  backend.beginFrame = () => {}
  backend.endFrame = () => {}
  const pipeline = new Pipeline({ passes: [] }, backend)
  const deltas = []
  pipeline.updateGlobalUniforms = (time, delta) => deltas.push(delta)
  for (const time of [0, 0.25, 0.9, 0.1]) pipeline.render(time)
  assert.deepEqual(deltas.slice(0, 3), [0, 0.25, 0.65])
  assert.ok(Math.abs(deltas[3] - 0.2) < 1e-12)
  pipeline.syncTime(0)
  pipeline.render(0.125)
  assert.equal(deltas.at(-1), 0.125)
})

test('ThreeBackend waits for submitted GPU work and releases its fence', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const calls = []
  const fence = {}
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, WAIT_FAILED: 4,
    fenceSync: (...args) => { calls.push(['fence', ...args]); return fence },
    flush: () => calls.push(['flush']),
    clientWaitSync: (...args) => { calls.push(['wait', ...args]); return gl.CONDITION_SATISFIED },
    deleteSync: value => calls.push(['delete', value]),
  }
  await ThreeBackend.prototype.waitForIdle.call({ gl })
  assert.deepEqual(calls, [['fence', 1, 0], ['flush'], ['wait', fence, 0, 0], ['delete', fence]])
})

test('triangle passes honor positive counts and fall back to mesh capacity', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const backend = Object.create(ThreeBackend.prototype)
  backend.textures = new Map([['mesh', { width: 3, height: 2 }]])
  const state = { globalUniforms: { vertices: 9 } }
  const pass = { drawMode: 'triangles', inputs: { meshPositions: 'mesh' }, countUniform: 'vertices' }
  const resolveOnGPU = (pass, state) => core.WebGPUBackend.prototype.resolveMeshVertexCount.call(backend, pass, state)
  for (const count of ['auto', 'screen', 'input']) {
    for (const resolve of [backend.resolveTriangleCount.bind(backend), resolveOnGPU]) {
      assert.equal(resolve({ ...pass, count }, state), 9)
      assert.equal(resolve({ ...pass, count, uniforms: { vertices: 3 } }, state), 3)
      for (const vertices of [0, -1, '3']) {
        assert.equal(resolve({ ...pass, count, uniforms: { vertices } }, state), 6)
      }
      assert.equal(resolve({ ...pass, count, inputs: {} }, {}), 3)
    }
  }
  assert.equal(backend.resolveTriangleCount({ ...pass, count: 12 }, {}), 12)
  assert.equal(backend.resolveTriangleCount({ ...pass, count: 12 }, state), 9)
  assert.equal(backend.resolveTriangleCount(pass, {}), 3)
})

test('the stable WebGL2 backend and ThreeBackend preserve ZERO', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const gl = { ZERO: 0, ONE: 1 }
  for (const zero of ['ZERO', 'zero', 0]) {
    assert.equal(core.WebGL2Backend.prototype.resolveBlendFactor.call({ gl }, zero), gl.ZERO)
    assert.equal(ThreeBackend.prototype._blendFactor(zero), ZeroFactor)
  }
  assert.equal(ThreeBackend.prototype._blendFactor('unknown'), OneFactor)
})

test('the stable WebGPU backend resolves GL color blend factors in both slots', () => {
  for (const [name, expected] of Object.entries({
    SRC_COLOR: 'src', DST_COLOR: 'dst',
    ONE_MINUS_SRC_COLOR: 'one-minus-src', ONE_MINUS_DST_COLOR: 'one-minus-dst',
  })) {
    for (const [blend, srcFactor, dstFactor] of [
      [[name, 'ZERO'], expected, 'zero'], [['ZERO', name], 'zero', expected],
    ]) {
      const state = core.WebGPUBackend.prototype.resolveBlendState(blend)
      assert.deepEqual(state.color, { srcFactor, dstFactor, operation: 'add' })
      assert.deepEqual(state.alpha, state.color)
    }
  }
})

test('scene, object literals and ordinary mixed argument calls stay unavailable', () => {
  for (const source of ['search synth\nscene().write(o0)', 'search synth\nlet node = {x: 1}\nnoise().write(o0)', 'search synth\nnoise(1, scaleX: 2).write(o0)']) {
    assert.throws(() => compileGraph(source), undefined, source)
  }
  for (const name of ['isScene', 'sceneTree', 'sceneRenderer', 'clock', 'loadGLTFFromURL', 'loadGLTFFromString']) {
    assert.ok(!(name in core.CanvasRenderer.prototype), name)
  }
})

for (const [field, input] of Object.entries({
  outputTex: 'inputTex', outputXyz: 'inputXyz', outputVel: 'inputVel', outputRgba: 'inputRgba',
})) {
  test(`effect configuration hands ${field} to the next effect`, () => {
    const source = `sync${field}Source`
    const reader = `sync${field}Reader`
    const shader = { glsl: 'precision highp float; out vec4 color; void main() { color = vec4(1.0); }' }
    for (const [name, definition] of [
      [source, {
        [field]: 'stateTex', textures: { stateTex: { width: 8, height: 8, format: 'rgba16f' } },
        passes: [{ program: 'main', outputs: { color: 'stateTex' } }],
      }],
      [reader, { passes: [{ program: 'main', inputs: { data: input }, outputs: { color: 'outputTex' } }] }],
    ]) {
      core.registerOp(`user.${name}`, { name, args: [] })
      core.registerEffect(`user.${name}`, new core.Effect({ name, func: name, shaders: { main: shader }, ...definition }))
    }
    core.registerStarterOps([`user.${source}`])
    const graph = compileGraph(`search user\n${source}().${reader}().write(o0)\nrender(o0)`)
    assert.equal(graph.passes.find(pass => pass.effectKey === `user.${reader}`).inputs.data, 'node_0_stateTex')
  })
}

test('a same-size texture is recreated when its required usage grows, then reused', async () => {
  const backend = new Backend()
  const flags = { render: 1, sample: 2, storage: 4, copySrc: 8, copyDst: 16 }
  backend.init = async () => {}
  backend.resolveUsage = names => names.reduce((bits, name) => bits | flags[name], 0)
  backend.createTexture = (id, spec) => {
    const texture = { ...spec, usage: backend.resolveUsage(spec.usage) }
    backend.textures.set(id, texture)
    return texture
  }
  backend.destroyTexture = id => backend.textures.delete(id)
  const spec = { width: 8, height: 8, format: 'rgba16f', usage: ['render', 'sample'] }
  const graph = { passes: [], textures: new Map([['node_0_out', spec]]) }
  const pipeline = new Pipeline(graph, backend)
  await pipeline.init(8, 8)
  const original = backend.textures.get('node_0_out')
  assert.equal(original.usage, 3)
  graph.textures.set('node_0_out', { ...spec, usage: ['render', 'sample', 'storage'] })
  pipeline.resize(8, 8)
  const writable = backend.textures.get('node_0_out')
  assert.notEqual(writable, original)
  assert.equal(writable.usage, 7)
  pipeline.resize(8, 8)
  assert.equal(backend.textures.get('node_0_out'), writable)
  pipeline.dispose()
})
