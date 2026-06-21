#!/usr/bin/env node
/**
 * Vendor the reference noisemaker core + effects into noisemaker-three.
 *
 * Layout decision: the reference effect `definition.js` files import the Effect
 * class via a RELATIVE path (`../../../src/runtime/effect.js`), and shaders are
 * associated by the `program -> glsl/<program>.glsl` naming convention. So we must
 * preserve the upstream `shaders/{src,effects}` sibling layout exactly. We mirror
 * it verbatim under `src/vendor/noisemaker/shaders/**` and never hand-edit it.
 *
 * We vendor the FULL `shaders/src` tree (not just the "pure" modules) because
 * `runtime/pipeline.js` has eager top-level imports of `backends/webgl2.js`,
 * `backends/webgpu.js`, and `renderer/cubeCamera.js`. Those backends are dead code
 * for us (we inject ThreeBackend and never call createPipeline's selector) and are
 * tree-shaken from production builds, but they must exist for import resolution.
 *
 * Outputs:
 *   src/vendor/noisemaker/shaders/src/**         (verbatim core)
 *   src/vendor/noisemaker/shaders/effects/**     (verbatim effect defs + glsl + wgsl)
 *   src/vendor/effects-manifest.json             (generated: {namespaces:{ns:[name...]}})
 *   src/vendor/UPSTREAM.json                     (provenance: upstream git commit)
 *
 * The reference repo is EXTERNAL and is NOT assumed to live at any particular
 * path — a clone of this repo won't have a sibling checkout. Pass it explicitly:
 *
 *   node tools/sync-upstream.mjs --ref <path-to-noisemaker>
 *   NM_REFERENCE_ROOT=<path> node tools/sync-upstream.mjs
 *
 * This is a maintainer-only tool; it is not on the `npm test` / build / library
 * path, which all run against the already-vendored copy under src/vendor/.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { writeManifest } from './vendor-manifest.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const refArgIdx = process.argv.indexOf('--ref')
const refArg = refArgIdx >= 0 ? process.argv[refArgIdx + 1] : process.env.NM_REFERENCE_ROOT
if (!refArg) {
  console.error(
    '[sync] ERROR: path to the external reference repo is required.\n' +
      '        Pass --ref <path> or set NM_REFERENCE_ROOT. (This repo does not\n' +
      '        depend on a sibling checkout; the vendored copy lives in src/vendor/.)'
  )
  process.exit(1)
}
const REF = path.resolve(repoRoot, refArg)

const SRC_SHADERS = path.join(REF, 'shaders')
const DST_VENDOR = path.join(repoRoot, 'src', 'vendor')
const DST_SHADERS = path.join(DST_VENDOR, 'noisemaker', 'shaders')

// Subdirs of upstream shaders/ to mirror verbatim.
const SUBTREES = ['src', 'effects']

// Repo-root upstream files outside shaders/ that core imports. `shaders/src/palettes.js`
// does `import ... from '../../share/palettes.json'`; mirrored to preserve that path.
const SHARE_FILES = ['palettes.json']

// Files allowed to have imports that escape the vendored tree (they import demo/UI
// code and are never in our import closure, so they never load).
const ESCAPE_ALLOWLIST = [
  path.join('src', 'index.js'),
  path.join('src', 'renderer', 'canvas.js'),
]

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyTree(src, dst) {
  let count = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true })
      count += copyTree(s, d)
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(d), { recursive: true })
      fs.copyFileSync(s, d)
      count++
    }
  }
  return count
}

function walkFiles(root, pred) {
  const out = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(p)
      else if (entry.isFile() && pred(p)) out.push(p)
    }
  }
  return out
}

function resolveImport(fromFile, spec) {
  // Returns absolute resolved path or null if unresolvable.
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, base + '.js', base + '.mjs', path.join(base, 'index.js')]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

function checkClosure() {
  const escapes = []
  const jsFiles = walkFiles(DST_SHADERS, (p) => /\.(js|mjs)$/.test(p))
  const importRe = /(?:from|import)\s*\(?\s*['"]((?:\.|\/)[^'"]+)['"]\)?/g
  for (const file of jsFiles) {
    const rel = path.relative(path.join(DST_VENDOR, 'noisemaker', 'shaders'), file)
    const text = fs.readFileSync(file, 'utf8')
    let m
    while ((m = importRe.exec(text)) !== null) {
      const spec = m[1]
      const resolved = resolveImport(file, spec)
      const vendorRoot = path.join(DST_VENDOR, 'noisemaker')
      const insideTree = resolved && resolved.startsWith(vendorRoot + path.sep)
      if (!insideTree) {
        if (ESCAPE_ALLOWLIST.includes(rel)) continue
        escapes.push({ file: rel, spec, resolved: resolved ? path.relative(repoRoot, resolved) : '(unresolved)' })
      }
    }
  }
  return escapes
}

function buildManifest() {
  const effectsRoot = path.join(DST_SHADERS, 'effects')
  const namespaces = {}
  for (const ns of fs.readdirSync(effectsRoot, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue
    const names = []
    for (const eff of fs.readdirSync(path.join(effectsRoot, ns.name), { withFileTypes: true })) {
      if (eff.isDirectory() && fs.existsSync(path.join(effectsRoot, ns.name, eff.name, 'definition.js'))) {
        names.push(eff.name)
      }
    }
    if (names.length) namespaces[ns.name] = names.sort()
  }
  return namespaces
}

// --- main ---
console.log(`[sync] reference: ${REF}`)
if (!fs.existsSync(SRC_SHADERS)) {
  console.error(`[sync] ERROR: ${SRC_SHADERS} not found`)
  process.exit(1)
}

const commit = execSync('git rev-parse HEAD', { cwd: REF, encoding: 'utf8' }).trim()

rmrf(path.join(DST_VENDOR, 'noisemaker'))
let total = 0
for (const sub of SUBTREES) {
  const n = copyTree(path.join(SRC_SHADERS, sub), path.join(DST_SHADERS, sub))
  console.log(`[sync] copied shaders/${sub}: ${n} files`)
  total += n
}

for (const f of SHARE_FILES) {
  const s = path.join(REF, 'share', f)
  const d = path.join(DST_VENDOR, 'noisemaker', 'share', f)
  fs.mkdirSync(path.dirname(d), { recursive: true })
  fs.copyFileSync(s, d)
  console.log(`[sync] copied share/${f}`)
  total++
}

const namespaces = buildManifest()
const effectCount = Object.values(namespaces).reduce((a, v) => a + v.length, 0)
fs.mkdirSync(DST_VENDOR, { recursive: true })
fs.writeFileSync(
  path.join(DST_VENDOR, 'effects-manifest.json'),
  JSON.stringify({ namespaces }, null, 2) + '\n'
)
fs.writeFileSync(
  path.join(DST_VENDOR, 'UPSTREAM.json'),
  JSON.stringify({ repo: 'noisemaker', commit, subtrees: SUBTREES.map((s) => `shaders/${s}`), syncedAt: new Date().toISOString() }, null, 2) + '\n'
)

console.log(`[sync] manifest: ${Object.keys(namespaces).length} namespaces, ${effectCount} effects`)
console.log(`[sync] upstream commit: ${commit}`)

// Self-contained integrity manifest (sha256 of every vendored file). This is what
// `npm test` verifies against — NOT the external reference — so the byte-identity
// guard works on any clone without a reference checkout.
const integrity = writeManifest({ commit })
console.log(`[sync] integrity manifest: ${integrity.fileCount} files (sha256)`)

const escapes = checkClosure()
if (escapes.length) {
  console.error(`[sync] CLOSURE FAIL: ${escapes.length} import(s) escape the vendored tree (and are not allowlisted):`)
  for (const e of escapes) console.error(`  ${e.file}  ->  ${e.spec}  (${e.resolved})`)
  process.exit(2)
}
console.log(`[sync] closure OK (${ESCAPE_ALLOWLIST.length} allowlisted demo/UI externals ignored)`)
console.log(`[sync] done: ${total} files vendored`)
