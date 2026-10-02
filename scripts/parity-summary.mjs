#!/usr/bin/env node
// parity-summary — renders cases of the current authority's manifest with THIS
// port and compares each with the authority's golden, printing a final
// machine-readable line:
//
//   PARITY-SUMMARY {"expected":N,"executed":N,"exact":N,"strict":N,"near":N,"defer":N,"skip":N,"fail":N,"missing":N}
//
// expected counts the authority's cases; exact the byte-identical ones; strict
// the other passes within the port's published numerical contract; near the
// tolerated mismatches beyond it; defer, skip, fail and missing the rest.
//
// Usage:
//   scripts/parity-summary [caseId...]
//
// With case ids it renders and counts only those; with none it covers the
// whole port: all current programs (the vendored authority manifest's
// renderable effect programs, via parity/current-programs.mjs), the stateful
// time-series set, and the fetched corpus programs. Classification:
//
//   programs + stateful + corpus: the enforced contract is bit-exactness —
//     the dual-backend harness runs compare.py at --tolerance 0 --ssim-min 1,
//     so every pass has max-abs-diff 0 (exact) and ANY nonzero diff is a
//     fail. 'strict' and 'near' exist only for completeness: a comparator
//     FAIL within a published numeric band (none is currently enforced)
//     would be near; beyond any band is fail.
//   The 7 documented golden-side S001 compile failures (parity/sweep-corpus.sh
//   TOLERATED_GOLDEN_S001; upstream defect — the GOLDEN side cannot compile)
//   classify as defer: the case is not renderable on the authority side.
//   An ERR with no result at all is fail; a case id that matches no fixture is
//   missing.
//
// Exit status is 0 only when executed == expected, exact + strict == executed,
// and near/defer/skip/fail/missing are all 0.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentPrograms } from '../parity/current-programs.mjs'

// Prerequisite check: fail loudly and self-diagnose instead of crashing with
// a raw stack when the vendored authority manifest, the corpus, or the venv
// python are missing (all are produced or fetched, not committed).
export function checkPrerequisites({ needCorpus = true } = {}) {
  const missing = []
  if (!existsSync(join(root, 'vendor', 'noisemaker', 'effects', 'manifest.json'))) {
    missing.push('vendor/noisemaker/effects/manifest.json (run: bash vendor/fetch.sh)')
  }
  if (!process.env.NM_PARITY_PYTHON && !existsSync(join(root, 'parity', '.venv', 'bin', 'python'))) {
    missing.push('parity/.venv/bin/python (run: uv venv parity/.venv && uv pip install -r parity/requirements.txt, or set NM_PARITY_PYTHON)')
  }
  if (needCorpus && !existsSync(join(root, 'parity', 'corpus'))) {
    missing.push('parity/corpus (run: node parity/fetch-corpus.mjs)')
  }
  if (missing.length) {
    process.stderr.write(`ERR  parity-summary prerequisites missing:\n  ${missing.join('\n  ')}\n`)
    process.exit(1)
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const progDir = join(root, 'parity', 'programs')
const corpusDir = join(root, 'parity', 'corpus')
const TOLERATED_GOLDEN_S001 = new Set('4bm9AA 8KMvAg B5oBsA PmJyUQ WyalUg fKPUww liTYEg'.split(' '))
const STATEFUL = new Set('navierStokes convolutionFeedback temporalAberration reactionDiffusion cellularAutomata feedback synth3d_cellularAutomata3d synth3d_reactionDiffusion3d filter3d_flow3d agent_buddhabrot agent_dla agent_physarum agent_physical'.split(' '))

export function classify({ name, worst, failLine, errLine, kind }) {
  if (TOLERATED_GOLDEN_S001.has(name) && errLine) return 'defer'
  if (errLine || worst === null || worst === undefined) return 'fail'
  const w = Number(worst)
  if (failLine) {
    // A comparator FAIL is a mismatch beyond the port's enforced bit-exact
    // contract; only a published numeric band (none currently enforced) would
    // make an in-band miss 'near'.
    return 'fail'
  }
  // The enforced contract is bit-exact (compare.py at tolerance 0, ssim-min
  // 1): every pass has max-abs-diff 0; ANY nonzero diff is a fail.
  if (w === 0) return 'exact'
  return 'fail'
}

function corpusExpected() {
  if (!existsSync(corpusDir)) return []
  const all = readdirSync(corpusDir).filter((f) => f.endsWith('.dsl')).map((f) => basename(f, '.dsl'))
  // Whole-port scope excludes the golden-side S001 set: those cases are not
  // renderable on the authority side, so they cannot be executed here.
  return all.filter((n) => !TOLERATED_GOLDEN_S001.has(n))
}

function programExpected() {
  return currentPrograms(readdirSync(progDir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))
}

// Programs whose parity case id differs from the manifest basename (a
// composite fixture exercises them, or the fixture carries a distinguishing
// suffix). Every entry must point at an existing fixture or the case is
// missing — the map is a coverage contract, not an exclusion.
const PROGRAM_CASE_BY_KEY = {
  'synth3d/cell3d': 'synth3d_cell3d',
  'synth3d/cellularAutomata3d': 'synth3d_cellularAutomata3d',
  'synth3d/flythrough3d': 'synth3d_flythrough3d',
  'synth3d/fractal3d': 'synth3d_fractal3d',
  'synth3d/heightmap3d': 'heightmap3d_landscape',
  'synth3d/reactionDiffusion3d': 'synth3d_reactionDiffusion3d',
  'synth3d/shape3d': 'synth3d_shape3d',
  'filter3d/palette3d': 'filter3d_palette3d',
  'filter3d/flow3d': 'filter3d_flow3d',
  'points/buddhabrot': 'agent_buddhabrot',
  'points/dla': 'agent_dla',
  'points/physarum': 'agent_physarum',
  'points/physical': 'agent_physical',
  'points/heightGrid': 'heightGrid_pointsRender_perspective',
  'render/renderCubemap3d': 'synth3d_renderCubemap3d',
  'render/renderCubemapSurface': 'synth3d_renderCubemapSurface',
  'render/renderLit3d': 'synth3d_renderLit3d',
  'render/renderLandscape3d': 'heightmap3d_landscape',
  'render/render3d': 'synth3d_cell3d',
  'render/meshLoader': 'mesh',
  'render/meshRender': 'mesh',
  'render/pointsEmit': 'agent_buddhabrot',
  'render/pointsRender': 'agent_buddhabrot',
  'render/pointsBillboardRender': 'heightGrid_billboard',
}

// Coverage audit over the AUTHORITY manifest: every renderable manifest
// program must map to a parity case that actually exercises it — a direct
// fixture (basename), a mapped composite fixture, or a fixture (programs or
// corpus) whose DSL text invokes the program. A manifest program with none of
// these is reported missing so a renderable authority addition can never be
// silently omitted from the whole-port scope.
export function auditAuthority({
  manifest = JSON.parse(readFileSync(join(root, 'vendor', 'noisemaker', 'effects', 'manifest.json'), 'utf8')),
  programIds = new Set(readdirSync(progDir).filter((f) => f.endsWith('.dsl')).map((f) => basename(f, '.dsl'))),
  fixtureText = (id) => {
    for (const dir of [progDir, corpusDir]) {
      const p = join(dir, `${id}.dsl`)
      if (existsSync(p)) return readFileSync(p, 'utf8')
    }
    return null
  },
  corpusIds = existsSync(corpusDir) ? readdirSync(corpusDir).filter((f) => f.endsWith('.dsl')).map((f) => basename(f, '.dsl')) : [],
  retired = currentPrograms,
} = {}) {
  const covered = []
  const missing = []
  const keys = Object.keys(manifest).filter((k) => manifest[k].glsl)
  for (const key of keys.sort()) {
    const name = key.split('/')[1]
    if (!retired([name], manifest, () => {}).includes(name)) continue // retired from the current engine
    const mapped = PROGRAM_CASE_BY_KEY[key]
    if (mapped && programIds.has(mapped)) { covered.push({ key, via: mapped }); continue }
    if (programIds.has(name)) { covered.push({ key, via: name }); continue }
    const corpusHit = corpusIds.find((id) => { const t = fixtureText(id); return t && new RegExp(`\\.${name}\\(`).test(t) })
    if (corpusHit) { covered.push({ key, via: corpusHit }); continue }
    missing.push(key)
  }
  return { keys: keys.length, covered, missing }
}

// Whole-port scope: current programs EXCLUDING the 13 stateful effects (they
// are counted as separate time-series cases — a single-frame render would not
// exercise their contract), the stateful set itself in time-series mode, and
// the renderable corpus (the 7 golden-side S001 fixtures excluded). 291 + 13
// + 81 = 385; the stateful fixtures are NOT double-counted.
export function wholePortIds() {
  const statefulIds = [...STATEFUL].filter((n) => existsSync(join(progDir, `${n}.dsl`)))
  return {
    programs: programExpected().filter((n) => !STATEFUL.has(n)),
    stateful: statefulIds,
    corpus: corpusExpected(),
  }
}

function kindOf(name) {
  if (existsSync(join(corpusDir, `${name}.dsl`))) return 'corpus'
  if (existsSync(join(progDir, `${name}.dsl`))) return STATEFUL.has(name) ? 'stateful' : 'programs'
  return null
}

const frames = { programs: ['--frames', '1', '--capture', '1'], stateful: ['--frames', '30', '--capture', '15'], corpus: ['--frames', '20', '--capture', '10'] }

// Pure output parser, separated from spawning so it is unit-testable: given a
// timeseries child's combined output and exit status, extract worst
// max-abs-diff (the trailing '= N' of the last 'worst max-abs-diff' line),
// whether any '[FAIL]' comparator line appeared, and whether the run produced
// no usable result (nonzero exit or missing summary line).
export function parseRender(out, status) {
  const line = out.split('\n').filter((l) => /worst max-abs-diff/.test(l)).pop()
  const m = line ? (line.match(/= ([0-9]+(?:\.[0-9]+)?)$/) || [])[1] : null
  return {
    worst: m === null || m === undefined ? null : m,
    failLine: out.split('\n').some((l) => /^\[FAIL\]/.test(l)),
    errLine: status !== 0 || !line,
  }
}

export function aggregateOk(c) {
  return c.executed === c.expected && c.exact + c.strict === c.executed && c.near === 0 && c.defer === 0 && c.skip === 0 && c.fail === 0 && c.missing === 0
}

function renderCase(name, kind) {
  const r = spawnSync('node', [join(root, 'parity', 'timeseries.mjs'), join(kind === 'corpus' ? corpusDir : progDir, `${name}.dsl`), ...frames[kind], '--size', '128'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 40 * 60 * 1000 })
  return parseRender(`${r.stdout || ''}${r.stderr || ''}`, r.status)
}

async function main() {
  const ids = process.argv.slice(2)
  checkPrerequisites({ needCorpus: !ids.length || ids.some((id) => existsSync(join(corpusDir, `${id}.dsl`))) })
  const scope = wholePortIds()
  const expectedIds = ids.length ? ids : [...scope.programs, ...scope.stateful, ...scope.corpus]
  const counts = { expected: expectedIds.length, executed: 0, exact: 0, strict: 0, near: 0, defer: 0, skip: 0, fail: 0, missing: 0 }
  if (!ids.length) {
    // Authority coverage audit: a renderable manifest program with no parity
    // case is missing, so the summary can never pass while the authority
    // gains an unrendered program.
    const audit = auditAuthority()
    for (const c of audit.covered) process.stdout.write(`covered ${c.key} via ${c.via}\n`)
    for (const key of audit.missing) { process.stdout.write(`missing ${key}\n`); counts.missing++ }
  }
  for (const id of expectedIds) {
    const kind = ids.length ? kindOf(id) : (STATEFUL.has(id) && existsSync(join(progDir, `${id}.dsl`)) ? 'stateful' : (existsSync(join(corpusDir, `${id}.dsl`)) ? 'corpus' : (programExpected().includes(id) ? 'programs' : null)))
    if (!kind) { counts.missing++; continue }
    const res = renderCase(id, kind)
    const status = classify({ name: id, worst: res.worst, failLine: res.failLine, errLine: res.errLine, kind })
    counts.executed++
    counts[status]++
    process.stdout.write(`${status} ${id} (worst=${res.worst}${res.failLine ? ' [FAIL]' : ''})\n`)
  }
  process.stdout.write(`PARITY-SUMMARY ${JSON.stringify(counts)}\n`)
  process.exit(aggregateOk(counts) ? 0 : 1)
}

// Only run the entrypoint when executed directly, so unit tests can import
// classify() without triggering the full whole-port render.
const isEntry = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)
if (isEntry) main()