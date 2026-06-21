import { test } from 'node:test'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Enforces the standing rule: the vendored core is NEVER hand-edited. Every file
// under src/vendor/noisemaker/ must be byte-identical to the recorded upstream
// commit. If this fails, someone edited vendored code (forbidden) or the sync is
// stale — re-run `npm run sync`.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const REF = path.resolve(root, '..', 'noisemaker')
const VENDOR = path.join(root, 'src', 'vendor', 'noisemaker')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

test('vendored core is byte-identical to recorded upstream commit', () => {
  const { commit } = JSON.parse(
    fs.readFileSync(path.join(root, 'src', 'vendor', 'UPSTREAM.json'), 'utf8')
  )
  assert.ok(commit, 'UPSTREAM.json records a commit')

  const files = walk(VENDOR)
  const mismatches = []
  for (const f of files) {
    const rel = path.relative(VENDOR, f) // e.g. "shaders/src/..." or "share/palettes.json"
    let upstream
    try {
      upstream = execFileSync('git', ['-C', REF, 'show', `${commit}:${rel}`], {
        maxBuffer: 64 * 1024 * 1024,
      })
    } catch {
      mismatches.push(`${rel} (missing upstream)`)
      continue
    }
    if (!upstream.equals(fs.readFileSync(f))) mismatches.push(rel)
  }

  assert.equal(
    mismatches.length,
    0,
    `vendored files diverge from upstream:\n  ${mismatches.slice(0, 15).join('\n  ')}`
  )
  assert.ok(files.length > 900, `expected >900 vendored files, got ${files.length}`)
})
