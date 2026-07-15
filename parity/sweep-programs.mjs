#!/usr/bin/env node
// sweep-programs.mjs — parity-validate every hand-authored fixture (parity/programs/*.dsl)
// through the dual-backend time-series harness (golden = reference WebGL2Backend, candidate =
// ThreeBackend, same vendored engine, identical deterministic time). Companion to
// sweep-corpus.sh (real gallery programs) and sweep-stateful.sh (named stateful effects, more
// frames/captures). This sweep is the ROSTER + MODE gate: one fixture per effect, and one
// fixture per (effect, mode) pair for effects with a compile-time MODE/define-selected variant
// (see parity/programs/<effect>_<mode>.dsl) — every fixture must be byte-exact (max-abs-diff=0);
// non-zero is an adapter bug, not something to tolerance-gate.
//
// Most parity/programs/*.dsl are single-frame filters (no cross-frame state), so the default is
// a cheap 1-frame capture — plenty to catch an adapter bug (wrong compiled shader variant, wrong
// uniform/texture binding, …), since golden and candidate receive the identical t. The handful of
// genuinely stateful fixtures in this directory (navierStokes, agent_*, cellularAutomata, …) get
// deeper multi-frame coverage from sweep-stateful.sh — this sweep still runs them at frame 1 as
// an extra proof point, it just isn't where their accumulated-state parity is authoritatively
// checked.
//
// Emits a machine-readable ledger keyed by fixture name -> {status, maxAbsDiff, golden,
// candidate} at parity/out/mode-ledger.json. Filtered runs write a separately named partial
// ledger so they cannot replace the canonical full-sweep evidence.
//
// Usage: node parity/sweep-programs.mjs [--frames 1] [--capture 1] [--size 128] [--filter <substr>]
import { readdirSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const argv = process.argv.slice(2)
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d }
const frames = opt('--frames', '1')
const capture = opt('--capture', '1')
const size = opt('--size', '128')
const filterSub = opt('--filter', null)

const progDir = join(repoRoot, 'parity', 'programs')
let files = readdirSync(progDir).filter((f) => f.endsWith('.dsl')).sort()
if (filterSub) files = files.filter((f) => f.includes(filterSub))
if (files.length === 0) {
  console.error(`ERR  no parity fixtures matched${filterSub ? ` filter ${JSON.stringify(filterSub)}` : ''}`)
  process.exit(1)
}

const outDir = join(repoRoot, 'parity', 'out')
mkdirSync(outDir, { recursive: true })

const ledger = {}
let pass = 0, fail = 0, err = 0, worst = 0
let batchOut = ''
let batchFailure = null
if (files.length > 0) {
  const temp = mkdtempSync(join(tmpdir(), 'noisemaker-three-sweep-'))
  const manifestPath = join(temp, 'manifest.json')
  writeFileSync(manifestPath, `${JSON.stringify({
    cases: files.map((f) => ({ dslPath: join(progDir, f), frames: Number(frames), capture: Number(capture), size: Number(size), loopFrames: 600 }))
  }, null, 2)}\n`)
  const timeseriesScript = process.env.NM_TIMESERIES_SCRIPT || join(repoRoot, 'parity', 'timeseries.mjs')
  const r = spawnSync('node', [timeseriesScript, '--batch-manifest', manifestPath], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  batchOut = `${r.stdout || ''}${r.stderr || ''}`
  if (r.status !== 0) batchFailure = `batched time-series runner exited ${r.status ?? r.signal ?? 'unknown'}`
  rmSync(temp, { recursive: true, force: true })
}

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
for (const f of files) {
  const name = basename(f, '.dsl')
  const sampleRe = new RegExp(`\\[(PASS|FAIL)\\] ${escapeRe(name)}@f(\\d+): max-abs-diff=([0-9.]+) mean-abs-diff=([0-9.]+) ssim=([0-9.]+)`, 'g')
  const samples = [...batchOut.matchAll(sampleRe)]
  const worstLine = new RegExp(`\\[ts\\] ${escapeRe(name)}: worst max-abs-diff across \\d+ samples = ([0-9.]+)`).exec(batchOut)
  if (samples.length === 0 || !worstLine) {
    const reasonLine = batchOut.split('\n').find((line) => line.includes(`[ts] ${name}: ERROR`)) || 'no result for fixture in batched time-series run'
    ledger[name] = { status: 'ERR', reason: reasonLine.slice(0, 200) }
    err++
    console.log(`ERR  ${name} | ${reasonLine.slice(0, 100)}`)
    continue
  }
  const maxDiff = Number(worstLine[1])
  const status = samples.some((sample) => sample[1] === 'FAIL') || maxDiff !== 0 ? 'FAIL' : 'PASS'
  const frameNum = samples[0][2]
  const golden = join('parity', 'out', `ts_${name}`, `f${frameNum}.golden.png`)
  const candidate = join('parity', 'out', `ts_${name}`, `f${frameNum}.candidate.png`)
  ledger[name] = { status, maxAbsDiff: maxDiff, golden, candidate }
  if (status === 'PASS') pass++
  else fail++
  worst = Math.max(worst, maxDiff)
  console.log(`${status} ${name} (max-abs-diff=${maxDiff})`)
}

if (batchFailure) {
  console.error(`ERR  batch | ${batchFailure}`)
  err++
}

const ledgerSuffix = filterSub ? `.${filterSub.replace(/[^a-zA-Z0-9_.-]/g, '_')}` : ''
const ledgerPath = join(outDir, `mode-ledger${ledgerSuffix}.json`)
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 1)}\n`)
console.log('')
console.log(`==== PROGRAMS SWEEP: PASS=${pass} FAIL=${fail} ERR=${err} worst=${worst} (frames=${frames} capture=${capture} size=${size}) ====`)
console.log(`ledger written: ${ledgerPath}`)
if (fail > 0 || err > 0) process.exitCode = 1
