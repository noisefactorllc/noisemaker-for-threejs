import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { buildManifest, MANIFEST_PATH, VENDOR_DIR } from '../tools/vendor-manifest.mjs'

// Enforces the standing rule: the vendored mirror is NEVER hand-edited. The reference
// engine is NOT committed to this repo (it loads from the CDN at runtime, or is mirrored
// locally via `npm run sync` into the git-ignored src/vendor/). When that local mirror is
// present, every file under it is verified (sha256) against the manifest `npm run sync`
// wrote — catching any hand-edit. When the mirror is absent (a fresh clone, before sync),
// the check skips cleanly. Self-contained either way: it never reaches outside this repo.

const mirrorPresent = fs.existsSync(MANIFEST_PATH) && fs.existsSync(VENDOR_DIR)

test(
  'vendored mirror matches the synced integrity manifest (sha256)',
  {
    skip: mirrorPresent
      ? false
      : 'src/vendor mirror absent — run `npm run sync` (NM_REFERENCE_ROOT=...) to populate it',
  },
  () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    assert.equal(manifest.algorithm, 'sha256', 'manifest records the sha256 algorithm')

    const recorded = manifest.files
    const actual = buildManifest()
    const recordedKeys = Object.keys(recorded)
    const actualKeys = Object.keys(actual)

    assert.ok(
      recordedKeys.length > 900,
      `expected >900 mirrored files, manifest has ${recordedKeys.length}`
    )

    const missing = recordedKeys.filter((rel) => !(rel in actual))
    const extra = actualKeys.filter((rel) => !(rel in recorded))
    const mismatches = recordedKeys.filter((rel) => rel in actual && actual[rel] !== recorded[rel])

    assert.equal(
      missing.length,
      0,
      `mirrored files MISSING vs manifest:\n  ${missing.slice(0, 15).join('\n  ')}`
    )
    assert.equal(
      extra.length,
      0,
      `UNTRACKED files under src/vendor/noisemaker (not in manifest):\n  ${extra.slice(0, 15).join('\n  ')}`
    )
    assert.equal(
      mismatches.length,
      0,
      `mirrored files HAND-EDITED (sha256 differs from manifest):\n  ${mismatches.slice(0, 15).join('\n  ')}`
    )
  }
)
