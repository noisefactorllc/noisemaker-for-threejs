import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Port of upstream shaders/tests/test_reserved_choice_names.mjs (noisemaker cb22a05e..e30f09e62704:
// 29e76468) onto the PUBLISHED engine bundle. A parameter's own choice names win over the DSL's
// state values: the unparser writes choices by bare name, so `geometry: seed` and `channel: a`
// have to compile back to the choice, not to the `seed` or `a` state value. The adapter executes
// the served bundle verbatim, so the contract is pinned against the vendored bytes (the mini-
// bundles register their choices/enums through the loader, as production does).
// Skips cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()
const core = eng?.core

const stepArgs = (compiled, op) => compiled.plans
  .flatMap(plan => plan.chain)
  .find(step => step.op === op).args

test('an inline choice named `seed` selects the choice', { skip }, () => {
  const sacredGeometry = core.getEffect('synth.sacredGeometry')
  const compiled = core.compile('search synth\nsacredGeometry(geometry: seed).write(o0)\nrender(o0)')
  assert.equal(stepArgs(compiled, 'synth.sacredGeometry').geometry, sacredGeometry.globals.geometry.choices.seed)
})

test('an enum member named `a` selects the member', { skip }, () => {
  // The published bundle resolves `channel: a` through its merged enum registry; 3 pins the
  // channel enum's alpha member (upstream std_enums: channel.a = 3).
  const compiled = core.compile('search synth, filter\nsacredGeometry().channel(channel: a).write(o0)\nrender(o0)')
  assert.equal(stepArgs(compiled, 'filter.channel').channel, 3)
})

test('the unparsed program compiles back to the same choices', { skip }, () => {
  const source = 'search synth, filter\nsacredGeometry(geometry: seed).channel(channel: a).write(o0)\nrender(o0)'
  const again = core.compile(core.unparse(core.compile(source), {}, {}))
  const sacredGeometry = core.getEffect('synth.sacredGeometry')
  assert.equal(stepArgs(again, 'synth.sacredGeometry').geometry, sacredGeometry.globals.geometry.choices.seed)
  assert.equal(stepArgs(again, 'filter.channel').channel, 3)
})

test('a state value still binds a parameter that has no such choice', { skip }, () => {
  const compiled = core.compile('search synth\nsacredGeometry(scale: seed).write(o0)\nrender(o0)')
  assert.equal(typeof stepArgs(compiled, 'synth.sacredGeometry').scale?.fn, 'function')
})