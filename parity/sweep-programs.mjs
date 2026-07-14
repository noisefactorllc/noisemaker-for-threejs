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
// candidate} at parity/out/mode-ledger.json (gitignored scratch, like CORPUS.txt — regenerate
// any time by re-running this script).
//
// Usage: node parity/sweep-programs.mjs [--frames 1] [--capture 1] [--size 128] [--filter <substr>]
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

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

const outDir = join(repoRoot, 'parity', 'out')
mkdirSync(outDir, { recursive: true })

const ledger = {}
let pass = 0, fail = 0, err = 0, worst = 0
for (const f of files) {
  const name = basename(f, '.dsl')
  const progPath = join(progDir, f)
  const r = spawnSync('node', [join(repoRoot, 'parity', 'timeseries.mjs'), progPath, '--frames', frames, '--capture', capture, '--size', size], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  const passLine = /\[(PASS|FAIL)\] (\S+)@f(\d+): max-abs-diff=([0-9.]+) mean-abs-diff=([0-9.]+) ssim=([0-9.]+)/.exec(out)
  const worstLine = /worst max-abs-diff across \d+ samples = ([0-9.]+)/.exec(out)
  if (!passLine) {
    const reasonLine = out.split('\n').filter((l) => /error|not yet|undefined|register/i.test(l))[0] || out.trim().split('\n').pop() || 'no result'
    ledger[name] = { status: 'ERR', reason: reasonLine.slice(0, 200) }
    err++
    console.log(`ERR  ${name} | ${reasonLine.slice(0, 100)}`)
    continue
  }
  const status = passLine[1]
  const maxDiff = Number(worstLine ? worstLine[1] : passLine[4])
  const frameNum = passLine[3]
  const golden = join('parity', 'out', `ts_${name}`, `f${frameNum}.golden.png`)
  const candidate = join('parity', 'out', `ts_${name}`, `f${frameNum}.candidate.png`)
  ledger[name] = { status, maxAbsDiff: maxDiff, golden, candidate }
  if (status === 'PASS') pass++
  else fail++
  worst = Math.max(worst, maxDiff)
  console.log(`${status} ${name} (max-abs-diff=${maxDiff})`)
}

const ledgerPath = join(outDir, 'mode-ledger.json')
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 1)}\n`)
console.log('')
console.log(`==== PROGRAMS SWEEP: PASS=${pass} FAIL=${fail} ERR=${err} worst=${worst} (frames=${frames} capture=${capture} size=${size}) ====`)
console.log(`ledger written: ${ledgerPath}`)
if (fail > 0 || err > 0) process.exitCode = 1
