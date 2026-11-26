import assert from 'node:assert/strict'
import test from 'node:test'
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

test('scene, object literals and ordinary mixed argument calls stay unavailable', () => {
  for (const source of ['search synth\nscene().write(o0)', 'search synth\nlet node = {x: 1}\nnoise().write(o0)', 'search synth\nnoise(1, scaleX: 2).write(o0)']) {
    assert.throws(() => compileGraph(source), undefined, source)
  }
  for (const name of ['isScene', 'sceneTree', 'sceneRenderer', 'clock', 'loadGLTFFromURL', 'loadGLTFFromString']) {
    assert.ok(!(name in core.CanvasRenderer.prototype), name)
  }
})
