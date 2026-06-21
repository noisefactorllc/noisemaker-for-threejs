import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { buildManifest, MANIFEST_PATH } from '../tools/vendor-manifest.mjs'

// Enforces the standing rule: the vendored core is NEVER hand-edited. Every file
// under src/vendor/noisemaker/ is verified (sha256) against the COMMITTED
// integrity manifest that `npm run sync` regenerates from the reference.
//
// This check is fully self-contained — it depends on nothing outside this repo,
// so it runs identically on any clone / CI machine (the reference repo is NOT
// required). If it fails, someone hand-edited vendored code (forbidden) or the
// manifest is stale — re-run `npm run sync`.

test('vendored core matches the committed integrity manifest (sha256)', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  assert.equal(manifest.algorithm, 'sha256', 'manifest records the sha256 algorithm')

  const recorded = manifest.files
  const actual = buildManifest()
  const recordedKeys = Object.keys(recorded)
  const actualKeys = Object.keys(actual)

  assert.ok(
    recordedKeys.length > 900,
    `expected >900 vendored files, manifest has ${recordedKeys.length}`
  )

  const missing = recordedKeys.filter((rel) => !(rel in actual))
  const extra = actualKeys.filter((rel) => !(rel in recorded))
  const mismatches = recordedKeys.filter((rel) => rel in actual && actual[rel] !== recorded[rel])

  assert.equal(
    missing.length,
    0,
    `vendored files MISSING vs manifest:\n  ${missing.slice(0, 15).join('\n  ')}`
  )
  assert.equal(
    extra.length,
    0,
    `UNTRACKED files under src/vendor/noisemaker (not in manifest):\n  ${extra.slice(0, 15).join('\n  ')}`
  )
  assert.equal(
    mismatches.length,
    0,
    `vendored files HAND-EDITED (sha256 differs from manifest):\n  ${mismatches.slice(0, 15).join('\n  ')}`
  )
})
