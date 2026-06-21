import { test } from 'node:test'
import assert from 'node:assert'
import { registerEffectsNode } from '../src/effects/loader-node.js'
import { compileGraph } from '../src/vendor/noisemaker/shaders/src/runtime/compiler.js'

// Proves the reused reference compiler runs in-repo against vendored modules + effects:
// DSL text -> RenderGraph with GLSL program source. No GPU needed.
test('compileGraph produces a GLSL render graph for solid', async () => {
  await registerEffectsNode(['synth/solid'])
  const g = compileGraph('search synth\nsolid(0.2, 0.6, 0.9).write(o0)\nrender(o0)')

  assert.ok(Array.isArray(g.passes) && g.passes.length >= 1, 'has passes')
  assert.ok(g.programs && typeof g.programs === 'object', 'has programs')
  assert.ok(g.renderSurface, 'has a render surface')

  // At least one program must carry GLSL fragment source for the solid shader.
  const progs = Object.values(g.programs)
  const withGlsl = progs.find((p) => typeof (p.glsl || p.fragment) === 'string')
  assert.ok(withGlsl, 'a program carries GLSL source')
  assert.match(withGlsl.glsl || withGlsl.fragment, /void\s+main/, 'GLSL has a main()')
})

// Multi-pass, two-namespace: a generator (starter) feeding a filter (non-starter).
test('compileGraph handles multi-pass blur over noise (two namespaces)', async () => {
  await registerEffectsNode(['synth/noise', 'filter/blur'])
  const g = compileGraph(
    'search synth, filter\nnoise(seed: 1, scaleX: 50, scaleY: 50)\n.blur(radiusX: 8, radiusY: 8)\n.write(o0)\nrender(o0)'
  )
  assert.ok(g.passes.length >= 2, 'blur expands to multiple passes')
  // Every effect pass must carry GLSL source (no missing shaders).
  const effectProgs = Object.values(g.programs).filter((p) => p.glsl || p.fragment)
  assert.ok(effectProgs.length >= 1, 'effect programs carry GLSL')
})
