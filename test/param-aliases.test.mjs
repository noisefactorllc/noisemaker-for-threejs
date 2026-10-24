import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Port of the fieldTex leg of upstream shaders/tests/test_param_aliases.js
// (noisemaker 27a2b58..d0ed94ae) onto the PUBLISHED engine bundle. Upstream restores
// `fieldTex` as a deprecated alias for `heightTex` on points/flow, points/physarum and
// points/dla, warned with S007 until 2027-06-01. The adapter executes the served bundle
// verbatim; the bundle registers the alias through CanvasRenderer.registerEffectWithRuntime,
// so the loader must route built-in instances carrying alias metadata through it.
// Skips cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()
const core = eng?.core

const DSL = (eff, param) =>
  `search synth, points\nnoise().write(o1)\nnoise().${eff}(${param}: read(o1)).write(o0)\nrender(o0)`

for (const effect of ['flow', 'dla', 'physarum']) {
  test(`${effect} accepts fieldTex as a deprecated alias for heightTex until 2027-06-01`, { skip }, () => {
    const aliased = core.compile(DSL(effect, 'fieldTex'))
    assert.ok(!aliased.diagnostics.some(d => d.severity === 'error'), JSON.stringify(aliased.diagnostics))
    const warning = aliased.diagnostics.find(d => d.code === 'S007')
    assert.match(warning?.message || '',
      /param 'fieldTex' is deprecated, use 'heightTex' instead\. Aliases will be removed on 2027-06-01\./)
    const canonical = core.compile(DSL(effect, 'heightTex'))
    assert.ok(!canonical.diagnostics.some(d => d.code === 'S007'), JSON.stringify(canonical.diagnostics))
    const aliasedStep = aliased.plans.flatMap(p => p.chain).find(s => s.op === `points.${effect}`)
    const canonicalStep = canonical.plans.flatMap(p => p.chain).find(s => s.op === `points.${effect}`)
    assert.deepEqual(aliasedStep.args.heightTex, canonicalStep.args.heightTex)
    assert.ok(!('fieldTex' in aliasedStep.args))
  })
}

test('an unregistered alias still fails validation like the bundle', { skip }, () => {
  // The alias registry only maps fieldTex -> heightTex; an unrelated retired name must
  // stay unknown so the portable retirement contract holds for built-ins too.
  const retired = core.compile(DSL('flow', 'notAParam'))
  assert.ok(retired.diagnostics.some(d => d.code === 'S001' && d.message.includes("Unknown argument 'notAParam'")),
    JSON.stringify(retired.diagnostics))
})
