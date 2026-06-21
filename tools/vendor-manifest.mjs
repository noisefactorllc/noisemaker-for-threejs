#!/usr/bin/env node
/**
 * Self-contained integrity manifest for the vendored reference tree.
 *
 * Maps every file under `src/vendor/noisemaker/` to its sha256. Written by
 * `npm run sync` (and regenerable on its own via `node tools/vendor-manifest.mjs`),
 * and verified on every `npm test` by `test/vendor-integrity.test.mjs`.
 *
 * The point: integrity is checked against this COMMITTED manifest, not against the
 * external reference repo. So the check needs nothing in `..` and runs identically
 * on any clone / CI machine, while still catching any hand-edit to vendored code.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '..')
export const VENDOR_DIR = path.join(REPO_ROOT, 'src', 'vendor', 'noisemaker')
export const MANIFEST_PATH = path.join(REPO_ROOT, 'src', 'vendor', 'vendor-manifest.json')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// rel(posix) -> sha256(hex) for every file under vendorDir, keys sorted for
// stable, reviewable diffs.
export function buildManifest(vendorDir = VENDOR_DIR) {
  const files = walk(vendorDir).sort()
  const out = {}
  for (const f of files) {
    const rel = path.relative(vendorDir, f).split(path.sep).join('/')
    out[rel] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  }
  return out
}

// Build + write the manifest document. `commit` is recorded for provenance only
// (the hashes are what the test enforces).
export function writeManifest({ commit = null } = {}) {
  const files = buildManifest()
  const doc = {
    algorithm: 'sha256',
    commit,
    fileCount: Object.keys(files).length,
    files,
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(doc, null, 2) + '\n')
  return doc
}

if (path.basename(process.argv[1] || '') === 'vendor-manifest.mjs') {
  let commit = null
  try {
    commit = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'src', 'vendor', 'UPSTREAM.json'), 'utf8')
    ).commit
  } catch {
    /* UPSTREAM.json optional for a standalone regen */
  }
  const doc = writeManifest({ commit })
  process.stdout.write(
    `[vendor-manifest] wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)} (${doc.fileCount} files, sha256)\n`
  )
}
