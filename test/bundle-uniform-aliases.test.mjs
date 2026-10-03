import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Port of upstream shaders/tests/test_uniform_aliases.mjs (noisemaker cb22a05e..e30f09e62704:
// bd773801, 71d805eb, 109c00ac) onto the PUBLISHED engine bundle. A pass can feed a renamed
// shader uniform from a global (pointsEmit: `uniforms: { layoutMode: "layout" }`); a live
// parameter change has to reach that shader uniform the way a recompile does. The adapter
// executes the served bundle verbatim, so the contract is pinned against the vendored bytes.
// Skips cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()
const core = eng?.core

const DSL = 'search points, synth, render\nnoise().pointsEmit().pointsRender().write(o0)\nrender(o0)'

function build () {
  const graph = eng.compileGraph(DSL)
  assert.equal((graph.diagnostics || []).length, 0, JSON.stringify(graph.diagnostics || graph))
  const renderer = Object.create(core.CanvasRenderer.prototype)
  renderer._pipeline = { graph, broadcastChainScopedParam () {} }
  renderer._currentDsl = DSL
  const init = graph.passes.find(p => p.effectKey === 'render.pointsEmit' && 'layoutMode' in (p.uniforms || {}))
  return { renderer, graph, init }
}

test('the expander records the renamed uniform on the pass', { skip }, () => {
  const { init } = build()
  assert.ok(init, 'pointsEmit init pass with layoutMode')
  assert.deepEqual(init.uniformAliases, { layoutMode: 'layout' })
  assert.equal(init.uniforms.layoutMode, 0)
})

test('applyStepParameterValues writes the aliased shader uniform', { skip }, () => {
  const { renderer, init } = build()
  renderer.applyStepParameterValues({ step_1: { layout: 3 } })
  assert.equal(init.uniforms.layout, 3)
  assert.equal(init.uniforms.layoutMode, 3)
})

test('applyParameterValues writes the aliased uniform on its own effect only', { skip }, () => {
  const { renderer, graph, init } = build()
  // Upstream pins this with render/pointsRender; it only shares the `layout` global name
  // through a planted alias, so a write there must stay on pointsEmit's passes.
  const other = graph.passes.find(p => p.effectKey === 'render.pointsRender')
  other.uniformAliases = { otherLayout: 'layout' }
  other.uniforms.otherLayout = 0
  const effect = { namespace: 'render', instance: core.getEffect('render.pointsEmit') }
  renderer._uniformBindings = new Map()
  renderer.applyParameterValues(effect, { layout: 2 })
  assert.equal(init.uniforms.layoutMode, 2)
  assert.equal(other.uniforms.otherLayout, 0)
})

test('a ProgramState change writes the aliased shader uniform', { skip }, () => {
  const { renderer, init } = build()
  const state = new core.ProgramState({ renderer })
  state.fromDsl(DSL)
  state.setValue('step_1', 'layout', 4)
  assert.equal(init.uniforms.layoutMode, 4)
})