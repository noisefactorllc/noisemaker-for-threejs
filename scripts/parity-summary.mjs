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
//     fail, except bloom@f1 at 128x128 within BLOOM_NEAR_BOUNDS below. That
//     bounded mismatch is deferred until its exact captures receive review.
//   Every corpus program is in scope; a program that calls user.* effects
//   renders with its published definitions (parity/corpus/<code>.effects.json).
//   An ERR with no result at all, on either side, is fail; a case id that
//   matches no fixture is missing.
//
// Exit status is 0 only when executed == expected and exact + strict equals
// executed, with near/defer/skip/fail/missing all 0.
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
const STATEFUL = new Set('navierStokes convolutionFeedback temporalAberration reactionDiffusion cellularAutomata feedback synth3d_cellularAutomata3d synth3d_reactionDiffusion3d filter3d_flow3d agent_buddhabrot agent_dla agent_dla_textures agent_base_color agent_physarum agent_physical'.split(' '))
const BLOOM_NEAR_BOUNDS = {
  max_abs_diff: 1.001, mean_abs_diff: 0.16, ssim_min: 0.9999,
  changed_pixels_max: 8192, changed_rgb_channels_max: 10485, changed_alpha_channels: 0,
}

export function classify({ name, worst, failLine, errLine, kind, samples = [] }) {
  if (errLine || worst === null || worst === undefined) return 'fail'
  const w = Number(worst)
  if (failLine) {
    const s = samples[0], b = BLOOM_NEAR_BOUNDS
    if (name === 'bloom' && kind === 'programs' && samples.length === 1 && validSample(s) &&
        s.name === 'bloom@f1' && s.shape[0] === 128 && s.shape[1] === 128 &&
        w > 0 && w <= b.max_abs_diff && s.max_abs_diff > 0 && s.max_abs_diff <= b.max_abs_diff &&
        s.mean_abs_diff <= b.mean_abs_diff && s.ssim >= b.ssim_min &&
        s.changed_pixels <= b.changed_pixels_max && s.changed_rgb_channels <= b.changed_rgb_channels_max &&
        s.changed_alpha_channels === b.changed_alpha_channels) return 'defer'
    return 'fail'
  }
  // The enforced contract is bit-exact (compare.py at tolerance 0, ssim-min
  // 1): every pass has max-abs-diff 0; ANY nonzero diff is a fail.
  if (w === 0) return 'exact'
  return 'fail'
}

function corpusExpected() {
  if (!existsSync(corpusDir)) return []
  return readdirSync(corpusDir).filter((f) => f.endsWith('.dsl')).map((f) => basename(f, '.dsl'))
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
    const corpusHit = corpusIds.find((id) => { const t = fixtureText(id); return t && new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`).test(t) })
    if (corpusHit) { covered.push({ key, via: corpusHit }); continue }
    missing.push(key)
  }
  return { keys: keys.length, covered, missing }
}

// Whole-port scope: current programs EXCLUDING the 15 stateful effects (they
// are counted as separate time-series cases — a single-frame render would not
// exercise their contract), the stateful set itself in time-series mode, and
// the whole corpus. 291 + 15 + 88 = 394; the stateful fixtures are NOT
// double-counted.
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

function validSample(s) {
  if (!s || typeof s.name !== 'string' || !Array.isArray(s.shape) || s.shape.length !== 3 ||
      !s.shape.every((n) => Number.isInteger(n) && n > 0) || s.shape[2] !== 4 ||
      !['max_abs_diff', 'mean_abs_diff', 'ssim'].every((key) => Number.isFinite(s[key])) ||
      s.max_abs_diff < 0 || s.max_abs_diff > 255.001 || s.mean_abs_diff < 0 || s.mean_abs_diff > s.max_abs_diff ||
      s.ssim < -1 || s.ssim > 1 || typeof s.passed !== 'boolean' || s.tolerance !== 0 || s.ssim_min !== 1) return false
  const pixels = s.shape[0] * s.shape[1]
  if (!['changed_pixels', 'changed_rgb_channels', 'changed_alpha_channels'].every((key) => Number.isInteger(s[key]) && s[key] >= 0)) return false
  return s.changed_pixels <= pixels && s.changed_rgb_channels <= 3 * s.changed_pixels &&
    s.changed_alpha_channels <= s.changed_pixels && s.changed_pixels <= s.changed_rgb_channels + s.changed_alpha_channels &&
    s.passed === (s.max_abs_diff === 0 && s.ssim === 1) &&
    (s.max_abs_diff === 0) === (s.changed_pixels === 0)
}

export function parseRender(out, status, { name, expectedSamples } = {}) {
  const lines = out.split('\n')
  const summaries = lines.filter((l) => /worst max-abs-diff/.test(l))
  const summary = summaries[0]?.match(/^\[ts\] (\S+): worst max-abs-diff across ([1-9][0-9]*) samples = ([0-9]+(?:\.[0-9]+)?)$/)
  const samples = []
  let invalid = false
  for (const line of lines.filter((l) => l.startsWith('PARITY-SAMPLE '))) {
    try { samples.push(JSON.parse(line.slice('PARITY-SAMPLE '.length))) } catch { invalid = true }
  }
  const failLine = lines.some((l) => /^\[FAIL\]/.test(l))
  const count = summary ? Number(summary[2]) : 0
  const caseName = name ?? summary?.[1]
  const complete = summary && summaries.length === 1 && summary[1] === caseName &&
    count === (expectedSamples ?? count) && samples.length === count && samples.every(validSample) &&
    new Set(samples.map((s) => s.name)).size === count &&
    samples.every((s) => s.name.startsWith(`${caseName}@f`) && /^\d+$/.test(s.name.slice(`${caseName}@f`.length)) &&
      lines.some((l) => l.startsWith(`[${s.passed ? 'PASS' : 'FAIL'}] ${s.name}: `))) &&
    lines.filter((l) => /^\[(PASS|FAIL)\]/.test(l)).length === count &&
    lines.includes(`[ts] ${caseName} golden: ${count} captures`) && lines.includes(`[ts] ${caseName} candidate: ${count} captures`) &&
    Number(summary[3]) === Math.max(...samples.map((s) => Number(s.max_abs_diff.toFixed(3))))
  return {
    worst: summary?.[3] ?? null, failLine, samples,
    errLine: invalid || !complete || status !== (failLine ? 1 : 0) || /\b(?:ERROR|FAILED)\b|^error:|^Traceback/m.test(out),
  }
}

export function aggregateOk(c) {
  return c.executed === c.expected && c.exact + c.strict === c.executed && c.near === 0 && c.defer === 0 && c.skip === 0 && c.fail === 0 && c.missing === 0
}

function renderCase(name, kind) {
  const r = spawnSync('node', [join(root, 'parity', 'timeseries.mjs'), join(kind === 'corpus' ? corpusDir : progDir, `${name}.dsl`), ...frames[kind], '--size', '128'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 40 * 60 * 1000 })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  // The harness's per-mode console counts pass through as recorded evidence;
  // they do not change the classification.
  const consoleLines = out.split('\n').filter((line) => line.startsWith('PARITY-CONSOLE '))
  return { ...parseRender(out, r.status, { name, expectedSamples: kind === 'programs' ? 1 : 2 }), consoleLines }
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
    const status = classify({ name: id, ...res, kind })
    counts.executed++
    counts[status]++
    for (const line of res.consoleLines) process.stdout.write(`${line}\n`)
    process.stdout.write(`${status} ${id} (worst=${res.worst}${res.failLine ? ' [FAIL]' : ''})\n`)
    if (status === 'defer') process.stdout.write(`NEAR-CANDIDATE ${JSON.stringify({ name: id, bounds: BLOOM_NEAR_BOUNDS, samples: res.samples })}\n`)
  }
  process.stdout.write(`PARITY-SUMMARY ${JSON.stringify(counts)}\n`)
  process.exit(aggregateOk(counts) ? 0 : 1)
}

// Only run the entrypoint when executed directly, so unit tests can import
// classify() without triggering the full whole-port render.
const isEntry = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)
if (isEntry) main()
