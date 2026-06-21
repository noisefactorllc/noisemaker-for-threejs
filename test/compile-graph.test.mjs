import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Proves the PUBLISHED engine (fetched from the CDN by vendor/fetch.sh) runs in-repo: DSL text
// -> RenderGraph with GLSL program source, no GPU needed. The core ESM + effect mini-bundles are
// loaded behind a DOM shim (vendor/engine.mjs). Skips cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()

test('compileGraph produces a GLSL render graph for solid', { skip }, () => {
  const g = eng.compileGraph('search synth\nsolid(0.2, 0.6, 0.9).write(o0)\nrender(o0)')
  assert.ok(Array.isArray(g.passes) && g.passes.length >= 1, 'has passes')
  assert.ok(g.programs && typeof g.programs === 'object', 'has programs')
  assert.ok(g.renderSurface, 'has a render surface')
  const withGlsl = Object.values(g.programs).find((p) => typeof (p.glsl || p.fragment) === 'string')
  assert.ok(withGlsl, 'a program carries GLSL source')
  assert.match(withGlsl.glsl || withGlsl.fragment, /void\s+main/, 'GLSL has a main()')
})

test('compileGraph handles multi-pass blur over noise (two namespaces)', { skip }, () => {
  const g = eng.compileGraph(
    'search synth, filter\nnoise(seed: 1, scaleX: 50, scaleY: 50)\n.blur(radiusX: 8, radiusY: 8)\n.write(o0)\nrender(o0)'
  )
  assert.ok(g.passes.length >= 2, 'blur expands to multiple passes')
  const effectProgs = Object.values(g.programs).filter((p) => p.glsl || p.fragment)
  assert.ok(effectProgs.length >= 1, 'effect programs carry GLSL')
})
