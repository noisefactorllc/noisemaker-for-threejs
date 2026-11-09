import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Ports upstream shaders/tests/test_stateful_instances.js (GAP-059, engine commit
// cf95f49c9007): each stateful effect instance in a chain gets its own private state
// texture and its own size parameter, while deliberately shared textures (loop
// accumulator, mesh buffers) and read-only external uploads keep their chain scope.
// The adapter executes the PUBLISHED engine (fetched by vendor/fetch.sh), so this test
// drives the vendored bundle through the repo's own loader (vendor/engine.mjs) and
// asserts the expanded graph and pipeline allocations. Skips cleanly when the engine
// isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()

class RecordingBackend {
  textures = new Map()
  createTexture (id, spec) { this.textures.set(id, { ...spec }) }
  destroyTexture (id) { this.textures.delete(id) }
}

function build (chain) {
  const graph = eng.compileGraph(`search synth, mixer, filter, render\n${chain}\nrender(o0)`)
  const pipeline = new eng.Pipeline(graph, new RecordingBackend())
  pipeline.width = 1024
  pipeline.height = 1024
  pipeline.createSurfaces()
  return { graph, pipeline }
}

function instances (graph, effectFunc, statePrefix) {
  const nodes = new Map()
  for (const pass of graph.passes.filter(p => p.effectFunc === effectFunc)) {
    if (!nodes.has(pass.nodeId)) nodes.set(pass.nodeId, { passes: [], textures: new Set(), stepIndex: pass.stepIndex })
    const node = nodes.get(pass.nodeId)
    node.passes.push(pass)
    for (const texture of [...Object.values(pass.inputs || {}), ...Object.values(pass.outputs || {})]) {
      if (typeof texture === 'string' && texture.startsWith(statePrefix)) node.textures.add(texture)
    }
  }
  return [...nodes.values()].map(node => {
    assert.equal(node.textures.size, 1, 'all passes in an instance must use the same state')
    return { ...node, texture: [...node.textures][0] }
  })
}

function assertSize (pipeline, texture, size) {
  for (const side of ['read', 'write']) {
    const spec = pipeline.backend.textures.get(`${texture}_${side}`)
    assert.ok(spec, `${texture}_${side} must be allocated`)
    assert.deepEqual([spec.width, spec.height], [size, size], `${texture}_${side}`)
  }
}

test('two reactionDiffusion instances in one chain have independent state and zoom sizes', { skip }, () => {
  const { graph, pipeline } = build('reactionDiffusion(zoom: x4).blendMode(tex: reactionDiffusion(zoom: x16)).write(o0)')
  const nodes = instances(graph, 'reactionDiffusion', 'global_rd_state')
  assert.equal(nodes.length, 2)
  assert.notEqual(nodes[0].texture, nodes[1].texture, 'state textures must be distinct')
  assertSize(pipeline, nodes[0].texture, 256)
  assertSize(pipeline, nodes[1].texture, 64)
  for (const [index, node] of nodes.entries()) {
    const sizingParam = graph.textures.get(node.texture).width.screenDivide
    for (const pass of node.passes) {
      assert.equal(pass.scopedParams.zoom, sizingParam)
      assert.equal(pass.uniforms[sizingParam], [4, 16][index])
    }
  }
})

test('repeated watercolor instances have independent ping-pong state', { skip }, () => {
  const { graph, pipeline } = build('perlin().watercolor().watercolor().write(o0)')
  const nodes = instances(graph, 'watercolor', 'global_wc_state')
  assert.equal(nodes.length, 2)
  assert.notEqual(nodes[0].texture, nodes[1].texture, 'state textures must be distinct')
  for (const node of nodes) assertSize(pipeline, node.texture, 1024)
})

test('single reactionDiffusion keeps the chain-scoped id', { skip }, () => {
  const { graph } = build('reactionDiffusion(zoom: x4).write(o0)')
  const nodes = instances(graph, 'reactionDiffusion', 'global_rd_state')
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].texture, 'global_rd_state_chain_0')
})

test('different stateful effects in one chain size from their own zoom', { skip }, () => {
  const { graph, pipeline } = build('reactionDiffusion(zoom: x4).blendMode(tex: cellularAutomata(zoom: x16)).write(o0)')
  const [rd] = instances(graph, 'reactionDiffusion', 'global_rd_state')
  const [ca] = instances(graph, 'cellularAutomata', 'global_ca_state')
  assert.equal(rd.texture, 'global_rd_state_chain_0')
  assert.equal(ca.texture, 'global_ca_state_chain_0')
  const rdParam = graph.textures.get(rd.texture).width.screenDivide
  const caParam = graph.textures.get(ca.texture).width.screenDivide
  assert.notEqual(rdParam, caParam, 'size parameters must be distinct')
  assertSize(pipeline, rd.texture, 256)
  assertSize(pipeline, ca.texture, 64)
})

test("changing one instance's zoom leaves the other's state size and uniform intact", { skip }, () => {
  const { graph, pipeline } = build('reactionDiffusion(zoom: x4).blendMode(tex: reactionDiffusion(zoom: x16)).write(o0)')
  const nodes = instances(graph, 'reactionDiffusion', 'global_rd_state')
  const renderer = Object.create(eng.core.CanvasRenderer.prototype)
  renderer._pipeline = pipeline
  renderer.applyStepParameterValues({ [`step_${nodes[1].stepIndex}`]: { zoom: 2 } })
  assertSize(pipeline, nodes[0].texture, 256)
  assertSize(pipeline, nodes[1].texture, 512)
  renderer.applyStepParameterValues({ [`step_${nodes[0].stepIndex}`]: { zoom: 32 } })
  assertSize(pipeline, nodes[0].texture, 32)
  assertSize(pipeline, nodes[1].texture, 512)
  for (const pass of nodes[1].passes) assert.equal(pass.uniforms.zoom, 2)
})

test('loopBegin and loopEnd retain their shared accumulator', { skip }, () => {
  for (const chain of [
    'perlin().loopBegin().loopEnd().write(o0)',
    'perlin().loopBegin().loopEnd().loopBegin().loopEnd().write(o0)'
  ]) {
    const { graph } = build(chain)
    for (const pass of graph.passes) {
      if (pass.effectFunc === 'loopBegin') assert.equal(pass.inputs.accumTex, 'global_accum_chain_0')
      if (pass.effectFunc === 'loopEnd' && pass.outputs.fragColor.startsWith('global_')) {
        assert.equal(pass.outputs.fragColor, 'global_accum_chain_0')
      }
    }
  }
})

test('meshLoader and meshRender retain their shared mesh buffers', { skip }, () => {
  const { graph } = build('meshLoader().meshRender().meshRender().write(o0)')
  const loader = graph.passes.find(p => p.effectFunc === 'meshLoader')
  const renderers = graph.passes.filter(p => p.effectFunc === 'meshRender' && p.inputs.meshPositions)
  assert.equal(renderers.length, 2)
  assert.equal(loader.inputs.positionsTex, 'global_mesh0_positions_chain_0')
  assert.equal(loader.inputs.normalsTex, 'global_mesh0_normals_chain_0')
  for (const renderer of renderers) {
    assert.equal(renderer.inputs.meshPositions, loader.inputs.positionsTex)
    assert.equal(renderer.inputs.meshNormals, loader.inputs.normalsTex)
  }
})

test('repeated state preserves each explicit or default zoom', { skip }, () => {
  const { graph, pipeline } = build('reactionDiffusion(zoom: x4).blendMode(tex: reactionDiffusion()).blendMode(tex: reactionDiffusion(zoom: x16)).write(o0)')
  const nodes = instances(graph, 'reactionDiffusion', 'global_rd_state')
  assert.equal(new Set(nodes.map(node => node.texture)).size, 3)
  for (const [index, node] of nodes.entries()) assertSize(pipeline, node.texture, [256, 128, 64][index])
})

test('repeated mesh renderers keep external buffers when the loader is in another chain', { skip }, () => {
  const { graph } = build('meshLoader().write(o0)\nread(o0).meshRender().meshRender().write(o1)')
  const renderers = graph.passes.filter(p => p.effectFunc === 'meshRender' && p.inputs.meshPositions)
  assert.equal(renderers.length, 2)
  for (const renderer of renderers) {
    assert.equal(renderer.inputs.meshPositions, 'global_mesh0_positions_chain_1')
    assert.equal(renderer.inputs.meshNormals, 'global_mesh0_normals_chain_1')
  }
})

test('single instances in later chains retain their existing texture IDs', { skip }, () => {
  const { graph, pipeline } = build('perlin().write(o0)\nreactionDiffusion(zoom: x4).watercolor().write(o1)')
  assert.equal(instances(graph, 'reactionDiffusion', 'global_rd_state')[0].texture, 'global_rd_state_chain_1')
  assert.equal(instances(graph, 'watercolor', 'global_wc_state')[0].texture, 'global_wc_state_chain_1')
  assertSize(pipeline, 'global_rd_state_chain_1', 256)
})
