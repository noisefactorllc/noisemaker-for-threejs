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
import { currentPrograms } from './current-programs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const argv = process.argv.slice(2)
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d }
const frames = opt('--frames', '1')
const capture = opt('--capture', '1')
const size = opt('--size', '128')
const filterSub = opt('--filter', null)
const excludeSub = opt('--exclude', null)
const shard = opt('--shard', null)

const progDir = join(repoRoot, 'parity', 'programs')
let files = readdirSync(progDir).filter((f) => f.endsWith('.dsl')).sort()
if (filterSub) files = files.filter((f) => f.includes(filterSub))
else files = currentPrograms(files.map(f => basename(f, '.dsl'))).map(name => `${name}.dsl`)
// Index-based sharding (--shard i/N): the sorted list is partitioned round-robin,
// so N shards cover every selected fixture exactly once. Shard coverage is
// asserted below; the gate denominator is the sum over shards.
let shardIdx = null
let shardCount = null
if (shard) {
  const m = /^([0-9]+)\/([0-9]+)$/.exec(shard)
  if (!m || !(+m[1] >= 0 && +m[1] < +m[2] && +m[2] > 0)) {
    console.error(`ERR  invalid --shard ${JSON.stringify(shard)} (expected i/N)`)
    process.exit(1)
  }
  shardIdx = +m[1]
  shardCount = +m[2]
  files = files.filter((f, idx) => idx % shardCount === shardIdx)
}
// --exclude applies AFTER shard selection so excluded-and-isolated cases (e.g.
// octaveWarp rendered in its own generously-bounded windows job) do not change
// any shard's index math: shard i/N keeps its cases minus the excluded set,
// and the union over all jobs still covers every fixture exactly once.
if (excludeSub) files = files.filter((f) => !f.includes(excludeSub))
if (files.length === 0) {
  console.error(`ERR  no parity fixtures matched${filterSub ? ` filter ${JSON.stringify(filterSub)}` : ''}${excludeSub ? ` exclude ${JSON.stringify(excludeSub)}` : ''}${shard ? ` shard ${shard}` : ''}`)
  process.exit(1)
}

const outDir = join(repoRoot, 'parity', 'out')
mkdirSync(outDir, { recursive: true })

const ledger = {}
let pass = 0, fail = 0, err = 0, worst = 0
let batchOut = ''
let batchFailure = null
if (files.length > 0) {
  // Chunk the batch: one chromium serving hundreds of page loads accumulates
  // memory until the child is SIGKILLed mid-run (CI runs 36477534981 ubuntu +
  // windows-4of6). Each chunk gets a fresh timeseries child (which also
  // restarts its browser every 25 cases); a chunk that fails is retried once,
  // and a still-failing chunk marks only its own cases ERR via the missing
  // results below.
  const CHUNK = 25
  const temp = mkdtempSync(join(tmpdir(), 'noisemaker-for-threejs-sweep-'))
  const timeseriesScript = process.env.NM_TIMESERIES_SCRIPT || join(repoRoot, 'parity', 'timeseries.mjs')
  for (let start = 0; start < files.length; start += CHUNK) {
    const chunk = files.slice(start, start + CHUNK)
    const manifestPath = join(temp, `manifest.${start}.json`)
    writeFileSync(manifestPath, `${JSON.stringify({
      cases: chunk.map((f) => ({ dslPath: join(progDir, f), frames: Number(frames), capture: Number(capture), size: Number(size), loopFrames: 600 }))
    }, null, 2)}\n`)
    let rc = null
    let signaled
    for (let attempt = 0; attempt < 2; attempt++) {
      // A hung child (hung page load or browser) must not hang the sweep until
      // the runner dies; the timeout bounds each chunk generously (default
      // 30 minutes; a single heavy-case job may raise it via NM_CHUNK_TIMEOUT_MS).
      const chunkTimeoutMs = Number(process.env.NM_CHUNK_TIMEOUT_MS || 30 * 60 * 1000)
      const r = spawnSync('node', [timeseriesScript, '--batch-manifest', manifestPath], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: chunkTimeoutMs })
      batchOut += `${r.stdout || ''}${r.stderr || ''}`
      rc = r.status
      signaled = r.status === null && r.signal !== null
      if (rc === 0) break
      // Retry only a KILLED chunk (hang/timeout — potentially transient).
      // A chunk that exited 1 with case ERRs is deterministic; re-rendering
      // it just burns the hosted runner's ~55-minute survival window.
      if (!signaled) break
      // Killing the chunk child orphans its chromium processes; a wedged GPU
      // process would poison the retry, so reap them (same targets as the
      // setup composite's orphaned-browser reaper, with self-excluding pkill
      // patterns so the invoking shell is not SIGTERMed).
      spawnSync('bash', ['-c', 'pkill -f chrome-headles[s]-shell; pkill -f headless_shel[l]; pkill -f chromiu[m]; command -v taskkill >/dev/null 2>&1 && taskkill //F //IM chrome-headless-shell.exe //T; command -v taskkill >/dev/null 2>&1 && taskkill //F //IM headless_shell.exe //T; true'], { timeout: 60000 })
    }
    if (rc !== 0) batchFailure = `chunk at ${start} exited ${rc ?? 'signal'} after retry`
  }
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
  const failSample = samples.find((sample) => sample[1] === 'FAIL')
  const status = (failSample || maxDiff !== 0) ? 'FAIL' : 'PASS'
  const frameNum = samples[0][2]
  const golden = join('parity', 'out', `ts_${name}`, `f${frameNum}.golden.png`)
  const candidate = join('parity', 'out', `ts_${name}`, `f${frameNum}.candidate.png`)
  ledger[name] = { status, maxAbsDiff: maxDiff, golden, candidate }
  if (status === 'PASS') pass++
  else fail++
  worst = Math.max(worst, maxDiff)
  // On a FAIL, repeat the raw compare line so the annotation channel carries
  // the measured ssim/tolerance (windows-only diagnosis, run 36505981849).
  const failLine = failSample ? batchOut.split('\n').find((line) => line.includes(`[FAIL] ${name}@f`)) : null
  const detail = failLine ? `; ${failLine}` : ''
  console.log(`${status} ${name} (max-abs-diff=${maxDiff})${detail}`)
}

if (batchFailure) {
  console.error(`ERR  batch | ${batchFailure}`)
  err++
}

const ledgerSuffix = filterSub ? `.${filterSub.replace(/[^a-zA-Z0-9_.-]/g, '_')}` : ''
const excludeSuffix = excludeSub ? `.no_${excludeSub.replace(/[^a-zA-Z0-9_.-]/g, '_')}` : ''
const shardSuffix = shard ? `.shard${shardIdx}of${shardCount}` : ''
const ledgerPath = join(outDir, `mode-ledger${ledgerSuffix}${excludeSuffix}${shardSuffix}.json`)
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 1)}\n`)
console.log('')
console.log(`==== PROGRAMS SWEEP: PASS=${pass} FAIL=${fail} ERR=${err} worst=${worst} (frames=${frames} capture=${capture} size=${size}${shard ? ` shard=${shard}` : ''}) ====`)
console.log(`ledger written: ${ledgerPath}`)
if (fail > 0 || err > 0) process.exitCode = 1
