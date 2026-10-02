// Unit tests for scripts/parity-summary.mjs classification: programs and
// stateful are bit-exact by contract (nonzero diff = fail), corpus has the
// published worst<=2.001 band (0=exact, within band=strict, FAIL within
// band=near, beyond=fail), the golden-side S001 set defers, and unresolved
// cases fail.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

const mod = await import('../scripts/parity-summary.mjs')
const { classify } = mod

test('programs and stateful: bit-exact PASS is exact, anything else is a fail', () => {
  assert.equal(classify({ name: 'fractal', worst: '0', failLine: false, errLine: false, kind: 'programs' }), 'exact')
  assert.equal(classify({ name: 'fractal', worst: '0.5', failLine: false, errLine: false, kind: 'programs' }), 'fail')
  assert.equal(classify({ name: 'navierStokes', worst: '0', failLine: false, errLine: false, kind: 'stateful' }), 'exact')
  assert.equal(classify({ name: 'navierStokes', worst: '0.5', failLine: false, errLine: false, kind: 'stateful' }), 'fail')
  assert.equal(classify({ name: 'fractal', worst: null, errLine: true, kind: 'programs' }), 'fail')
})

test('corpus: worst 0 exact, ANY nonzero difference is a fail (tolerance-0 contract)', () => {
  assert.equal(classify({ name: 'AbCdEf', worst: '0', failLine: false, errLine: false, kind: 'corpus' }), 'exact')
  assert.equal(classify({ name: 'AbCdEf', worst: '1.5', failLine: false, errLine: false, kind: 'corpus' }), 'fail')
  assert.equal(classify({ name: 'AbCdEf', worst: '1.5', failLine: true, errLine: false, kind: 'corpus' }), 'fail')
  assert.equal(classify({ name: 'AbCdEf', worst: '3', failLine: true, errLine: false, kind: 'corpus' }), 'fail')
  assert.equal(classify({ name: 'AbCdEf', worst: '3', failLine: false, errLine: false, kind: 'corpus' }), 'fail')
})

test('a tolerated golden-side S001 compile failure defers', () => {
  assert.equal(classify({ name: '4bm9AA', worst: null, errLine: true, kind: 'corpus' }), 'defer')
})

test('whole-port scope: 291 single-frame programs + 13 stateful + 81 corpus, disjoint, S001 excluded', () => {
  const scope = mod.wholePortIds()
  const total = [...scope.programs, ...scope.stateful, ...scope.corpus]
  // No double count: the 13 stateful fixtures live in parity/programs and are
  // removed from the single-frame program set before being re-added as
  // time-series cases.
  assert.equal(new Set(total).size, total.length, 'duplicate ids in the whole-port scope')
  assert.equal(scope.stateful.length, 13)
  assert.equal(scope.corpus.length, 81)
  for (const s001 of '4bm9AA 8KMvAg B5oBsA PmJyUQ WyalUg fKPUww liTYEg'.split(' ')) {
    assert.ok(!total.includes(s001), `golden-side S001 fixture ${s001} must not be in the whole-port scope`)
  }
  assert.equal(scope.programs.length + scope.stateful.length + scope.corpus.length, 385)
})

test('parseRender extracts the worst diff, [FAIL] lines, and unusable results', () => {
  const ok = mod.parseRender([
    '[PASS] fractal@f1: max-abs-diff=0 mean-abs-diff=0 ssim=1',
    '[ts] fractal: worst max-abs-diff across 1 samples = 0',
  ].join('\n'), 0)
  assert.deepEqual(ok, { worst: '0', failLine: false, errLine: false })

  const worstFloat = mod.parseRender('noise [ts] x: worst max-abs-diff across 3 samples = 2.5\n', 0)
  assert.equal(worstFloat.worst, '2.5')
  assert.equal(worstFloat.errLine, false)

  const failed = mod.parseRender('[FAIL] somecase@f2: ssim=0.98\n[ts] somecase: worst max-abs-diff across 2 samples = 1\n', 0)
  assert.equal(failed.failLine, true)
  assert.equal(failed.worst, '1')

  // Nonzero exit or missing summary line = unusable result.
  assert.equal(mod.parseRender('boom\n', 1).errLine, true)
  assert.equal(mod.parseRender('boom\n', 0).errLine, true)
  assert.equal(mod.parseRender('', 0).errLine, true)
  // The worst value must come from the LAST summary line, not earlier text.
  const lastLineWins = mod.parseRender('[ts] a: worst max-abs-diff across 1 samples = 5\n[ts] b: worst max-abs-diff across 1 samples = 0\n', 0)
  assert.equal(lastLineWins.worst, '0')
})

test('aggregateOk enforces the PARITY-SUMMARY exit contract', () => {
  const zero = { expected: 3, executed: 3, exact: 3, strict: 0, near: 0, defer: 0, skip: 0, fail: 0, missing: 0 }
  assert.equal(mod.aggregateOk(zero), true)
  for (const bad of [
    { ...zero, exact: 2, fail: 1 },
    { ...zero, executed: 2, missing: 1, exact: 2 },
    { ...zero, exact: 2, strict: 0, near: 1 },
    { ...zero, exact: 2, defer: 1 },
    { ...zero, expected: 4 },
  ]) {
    assert.equal(mod.aggregateOk(bad), false, JSON.stringify(bad))
  }
})

// Authority coverage audit: a renderable manifest program with no parity case
// must surface as missing instead of being silently omitted from the scope.
function auditWith(manifest, { programIds = new Set(), corpusIds = [], text = {} } = {}) {
  return mod.auditAuthority({
    manifest,
    programIds,
    corpusIds,
    fixtureText: (id) => text[id] ?? null,
  })
}

test('auditAuthority: direct fixture, composite map, and corpus invocation each cover', () => {
  const manifest = { 'filter/adjust': { glsl: { adjust: 'combined' } }, 'synth3d/cell3d': { glsl: { precompute: 'combined' } }, 'render/loopBegin': { glsl: { loopBegin: 'combined' } } }
  const a = auditWith(manifest, {
    programIds: new Set(['adjust', 'synth3d_cell3d']),
    corpusIds: ['cw1'],
    text: { cw1: 'noise().subchain() {\n    .loopBegin(alpha: 95)\n  }\n' },
  })
  assert.deepEqual(a.missing, [])
  assert.equal(a.keys, 3)
  assert.ok(a.covered.some((c) => c.key === 'filter/adjust' && c.via === 'adjust'))
  assert.ok(a.covered.some((c) => c.key === 'synth3d/cell3d' && c.via === 'synth3d_cell3d'))
  assert.ok(a.covered.some((c) => c.key === 'render/loopBegin' && c.via === 'cw1'))
})

test('auditAuthority: a renderable manifest program without any case is missing', () => {
  const manifest = { 'filter/newEffect': { glsl: { newEffect: 'combined' } } }
  const a = auditWith(manifest, {})
  assert.deepEqual(a.missing, ['filter/newEffect'])
})

test('auditAuthority: a stale composite map entry is missing, not silently covered', () => {
  const manifest = { 'render/renderCubemap3d': { glsl: { renderCubemap3d: 'combined' } } }
  const a = auditWith(manifest, { programIds: new Set(['unrelated']) })
  assert.deepEqual(a.missing, ['render/renderCubemap3d'])
})

test('auditAuthority: a program retired from the current engine is not counted', () => {
  const manifest = {}
  const a = auditWith(manifest, { programIds: new Set(['bc']) })
  assert.deepEqual(a.missing, [])
  assert.equal(a.keys, 0)
})

test('auditAuthority: corpus invocation matching survives regex metacharacters in a name', () => {
  const manifest = { 'filter/o.d.d': { glsl: { odd: 'combined' } } }
  const a = auditWith(manifest, { corpusIds: ['cw1'], text: { cw1: 'noise().o.d.d().write(o0)\n' } })
  assert.deepEqual(a.missing, [])
  assert.ok(a.covered.some((c) => c.key === 'filter/o.d.d' && c.via === 'cw1'))
})

// The audit must hold against the real vendored manifest, not only synthetic
// fixtures: when the authority manifest is fetched (vendor/fetch.sh), every
// renderable glsl program must map to a parity case. Skips when the manifest
// is not vendored so the suite stays runnable without vendor/.
test('auditAuthority: the vendored authority manifest has zero uncovered programs', { skip: !existsSync(new URL('../vendor/noisemaker/effects/manifest.json', import.meta.url)) }, () => {
  const a = mod.auditAuthority()
  assert.deepEqual(a.missing, [], `uncovered authority programs: ${a.missing.join(', ')}`)
  assert.ok(a.keys > 200, `unexpectedly small manifest: ${a.keys} glsl programs`)
})