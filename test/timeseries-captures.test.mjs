import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { captureMismatch, expectedCaptures, samplePassed } from '../parity/timeseries-captures.mjs'

// parity/timeseries.mjs compares every captured frame of a case. A case that
// captures nothing, a golden or candidate run that returns fewer or more
// captures than the case asks for, and a manifest with no cases must each
// fail rather than pass with nothing compared.
const repo = fileURLToPath(new URL('..', import.meta.url))

test('a case captures one frame per capture interval it completes', () => {
  assert.equal(expectedCaptures(20, 10), 2)
  assert.equal(expectedCaptures(30, 15), 2)
  assert.equal(expectedCaptures(1800, 300), 6)
  assert.equal(expectedCaptures(25, 10), 2)
  for (const [frames, capture] of [[5, 10], [0, 10], [20, 0], [20, -1], [20.5, 10], [Number.NaN, 10]]) {
    assert.equal(expectedCaptures(frames, capture), 0, `${frames} frames, capture ${capture}`)
  }
})

test('the formula follows the page capture rule', () => {
  const page = readFileSync(new URL('../parity/page-timeseries.html', import.meta.url), 'utf8')
  assert.match(page, /if \(\(i \+ 1\) % captureEvery === 0\) \{/)
})

test('only a full, equal set of captures can be compared', () => {
  const two = [{ frame: 10 }, { frame: 20 }]
  assert.equal(captureMismatch(2, two, two), null)
  assert.match(captureMismatch(0, [], []), /captures no frame/)
  assert.match(captureMismatch(2, [], []), /expected 2 captures, golden returned 0, candidate 0/)
  assert.match(captureMismatch(2, two, two.slice(0, 1)), /candidate 1/)
  assert.match(captureMismatch(2, two.slice(0, 1), two), /golden returned 1/)
  assert.match(captureMismatch(2, two, [...two, { frame: 30 }]), /candidate 3/)
})

test('a capture passes only with the compare verdict for its own label', () => {
  const pass = '[PASS] media@f10: max-abs-diff=0.000 mean-abs-diff=0.0000 ssim=1.00000 (tol=0.0, ssim_min=1.0)\nPARITY-SAMPLE {}'
  assert.equal(samplePassed(0, pass, 'media@f10'), true)
  assert.equal(samplePassed(0, '', 'media@f10'), false)
  assert.equal(samplePassed(0, undefined, 'media@f10'), false)
  assert.equal(samplePassed(null, pass, 'media@f10'), false)
  assert.equal(samplePassed(1, pass, 'media@f10'), false)
  assert.equal(samplePassed(0, pass, 'media@f20'), false)
  assert.equal(samplePassed(0, pass, 'medi.@f10'), false)
  assert.equal(samplePassed(0, pass.replace('[PASS]', '[FAIL]'), 'media@f10'), false)
  assert.equal(samplePassed(0, '[PASS] media@f10: max-abs-diff=n/a', 'media@f10'), false)
})

function runManifest (cases) {
  const dir = mkdtempSync(join(tmpdir(), 'nm-ts-manifest-'))
  try {
    const manifest = join(dir, 'manifest.json')
    writeFileSync(manifest, JSON.stringify({ cases }))
    return spawnSync(process.execPath, [join(repo, 'parity', 'timeseries.mjs'), '--batch-manifest', manifest],
      { cwd: repo, encoding: 'utf8', timeout: 120000, env: { ...process.env, NM_TS_TIMEOUT_MS: '60000' } })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a manifest with no cases fails before any browser starts', () => {
  const run = runManifest([])
  assert.equal(run.status, 1, run.stdout + run.stderr)
  assert.match(run.stderr, /\[ts\] FAILED: the manifest lists no cases/)
})

test('a case that captures no frame fails before any browser starts', () => {
  const run = runManifest([{ dslPath: join(repo, 'parity', 'programs', 'media.dsl'), frames: 5, capture: 10, size: 64 }])
  assert.equal(run.status, 1, run.stdout + run.stderr)
  assert.match(run.stderr, /\[ts\] FAILED: media\.dsl: 5 frames with a capture every 10 frames capture no frame/)
})
