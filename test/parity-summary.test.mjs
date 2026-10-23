// Unit tests for scripts/parity-summary.mjs classification: corpus, stateful,
// and unlisted programs require exact output. Only the bounded bloom frame
// qualifies as NEAR. Incomplete samples and renderer errors always fail.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PNG } from 'pngjs'

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

test('a corpus compile failure fails, whichever program it is', () => {
  for (const name of ['4bm9AA', 'B5oBsA', 'AbCdEf']) {
    assert.equal(classify({ name, worst: null, errLine: true, kind: 'corpus' }), 'fail')
  }
})

test('whole-port scope: 291 single-frame programs + 15 stateful + 88 corpus, disjoint, none excluded', () => {
  const scope = mod.wholePortIds()
  const total = [...scope.programs, ...scope.stateful, ...scope.corpus]
  // No double count: the 15 stateful fixtures live in parity/programs and are
  // removed from the single-frame program set before being re-added as
  // time-series cases.
  assert.equal(new Set(total).size, total.length, 'duplicate ids in the whole-port scope')
  assert.equal(scope.stateful.length, 15)
  assert.equal(scope.corpus.length, 88)
  for (const userEffectProgram of '4bm9AA 7INvow B5oBsA PmJyUQ d-MpwA fKPUww liTYEg'.split(' ')) {
    assert.ok(total.includes(userEffectProgram), `user-effect corpus program ${userEffectProgram} must be in the whole-port scope`)
  }
  assert.equal(scope.programs.length + scope.stateful.length + scope.corpus.length, 394)
})

const bloomSample = {
  name: 'bloom@f1', shape: [128, 128, 4], max_abs_diff: 1,
  mean_abs_diff: 0.159454345703125, ssim: 0.9999825271165335,
  changed_pixels: 8105, changed_rgb_channels: 10450, changed_alpha_channels: 0,
  tolerance: 0, ssim_min: 1, passed: false,
}

function renderOutput(samples = [bloomSample], { name = 'bloom', count = samples.length } = {}) {
  return [
    `[ts] ${name} golden: ${count} captures`,
    `[ts] ${name} candidate: ${count} captures`,
    ...samples.flatMap((sample) => [
      `[${sample.passed ? 'PASS' : 'FAIL'}] ${sample.name}: max-abs-diff=${sample.max_abs_diff.toFixed(3)} mean-abs-diff=${sample.mean_abs_diff.toFixed(4)} ssim=${sample.ssim.toFixed(5)} (tol=0, ssim_min=1)`,
      `PARITY-SAMPLE ${JSON.stringify(sample)}`,
    ]),
    `[ts] ${name}: worst max-abs-diff across ${count} samples = ${Math.max(...samples.map((sample) => Number(sample.max_abs_diff.toFixed(3))))}`,
  ].join('\n')
}

test('parseRender distinguishes complete comparator exit 1 from renderer errors', () => {
  const mismatch = mod.parseRender(renderOutput(), 1, { name: 'bloom', expectedSamples: 1 })
  assert.equal(mismatch.worst, '1')
  assert.equal(mismatch.failLine, true)
  assert.equal(mismatch.errLine, false)
  assert.deepEqual(mismatch.samples, [bloomSample])
  const exact = { ...bloomSample, max_abs_diff: 0, mean_abs_diff: 0, ssim: 1, changed_pixels: 0, changed_rgb_channels: 0, passed: true }
  assert.equal(mod.parseRender(renderOutput([exact]), 0).errLine, false)
  for (const status of [2, null]) assert.equal(mod.parseRender(renderOutput(), status).errLine, true)
  assert.equal(mod.parseRender(`${renderOutput()}\n[ts] bloom: ERROR browser crashed`, 1).errLine, true)
  assert.equal(mod.parseRender(renderOutput(), 0).errLine, true)
})

test('parseRender rejects missing, malformed, duplicate, or incomplete comparator samples', () => {
  for (const out of [
    '', 'boom', '[ts] bloom: worst max-abs-diff across 1 samples = 0',
    renderOutput().replace(/^PARITY-SAMPLE .*$/m, ''),
    renderOutput().replace(/^PARITY-SAMPLE .*$/m, 'PARITY-SAMPLE {'),
    renderOutput().replace('candidate: 1 captures', 'candidate: 0 captures'),
    renderOutput().replace('across 1 samples', 'across 0 samples'),
    renderOutput([{ ...bloomSample, name: 'noise@f1' }]),
    renderOutput([bloomSample, bloomSample]),
  ]) assert.equal(mod.parseRender(out, 1).errLine, true, out)
  assert.equal(mod.parseRender(renderOutput(), 1, { name: 'bloom', expectedSamples: 2 }).errLine, true)
  assert.equal(mod.parseRender(renderOutput(), 1, { name: 'noise', expectedSamples: 1 }).errLine, true)
})

test('only the complete bloom frame within all bounds is deferred for visual review', () => {
  const result = { name: 'bloom', kind: 'programs', ...mod.parseRender(renderOutput(), 1) }
  assert.equal(classify(result), 'defer')
  assert.equal(classify({ ...result, name: 'noise' }), 'fail')
  assert.equal(classify({ ...result, kind: 'corpus' }), 'fail')
  assert.equal(classify({ ...result, errLine: true }), 'fail')
  assert.equal(classify({ ...result, samples: [] }), 'fail')
  for (const patch of [
    { max_abs_diff: 2 }, { mean_abs_diff: 0.161 }, { ssim: 0.9998 },
    { changed_alpha_channels: 1 }, { changed_pixels: 8193 }, { changed_rgb_channels: 10486 },
    { shape: [256, 256, 4] }, { name: 'bloom@f2' }, { ssim: null },
    { changed_pixels: undefined },
  ]) assert.equal(classify({ ...result, samples: [{ ...bloomSample, ...patch }] }), 'fail', JSON.stringify(patch))
})

test('compare.py reports raw changed pixel and channel counts', (t) => {
  const python = process.env.NM_PARITY_PYTHON || (existsSync('parity/.venv/bin/python') ? 'parity/.venv/bin/python' : 'python3')
  const probe = spawnSync(python, ['-c', 'import numpy, PIL'], { encoding: 'utf8' })
  if (probe.status !== 0) {
    t.skip('compare.py needs Python with NumPy and Pillow; the rendered parity setup installs them')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'threejs-compare-'))
  try {
    const golden = new PNG({ width: 2, height: 1 })
    golden.data.set([10, 20, 30, 255, 40, 50, 60, 255])
    const candidate = new PNG({ width: 2, height: 1 })
    candidate.data.set([11, 20, 30, 253, 40, 50, 60, 255])
    const g = join(dir, 'golden.png'), c = join(dir, 'candidate.png')
    writeFileSync(g, PNG.sync.write(golden))
    writeFileSync(c, PNG.sync.write(candidate))
    const run = spawnSync(python, ['parity/compare.py', g, c, '--name=bloom@f1', '--tolerance=0', '--ssim-min=1', '--json'], { encoding: 'utf8' })
    assert.equal(run.status, 1, run.stderr)
    const line = run.stdout.split('\n').find((line) => line.startsWith('PARITY-SAMPLE '))
    assert.ok(line, run.stdout)
    const sample = JSON.parse(line.slice('PARITY-SAMPLE '.length))
    assert.equal(sample.changed_pixels, 1)
    assert.equal(sample.changed_rgb_channels, 1)
    assert.equal(sample.changed_alpha_channels, 1)
    assert.equal(sample.passed, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('aggregateOk enforces the PARITY-SUMMARY exit contract', () => {
  const zero = { expected: 3, executed: 3, exact: 3, strict: 0, near: 0, defer: 0, skip: 0, fail: 0, missing: 0 }
  assert.equal(mod.aggregateOk(zero), true)
  assert.equal(mod.aggregateOk({ ...zero, exact: 2, near: 1 }), false)
  for (const bad of [
    { ...zero, exact: 2, fail: 1 },
    { ...zero, executed: 2, missing: 1, exact: 2 },
    { ...zero, exact: 2, strict: 0, near: 0 },
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
