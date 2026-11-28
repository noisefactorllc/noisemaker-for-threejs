import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { stableSourceIdentity } from '../parity/stable-source-identity.mjs'

test('installed engine identity covers imported sources and rejects altered manifests', () => {
  const root = mkdtempSync(join(tmpdir(), 'stable-engine-test-'))
  try {
    const expected = join(root, 'expected'), installed = join(root, 'installed')
    mkdirSync(join(expected, 'stable-source'), { recursive: true })
    const entry = "export * from './stable-source/core.js'\n"
    const source = 'export const value = 1\n'
    const hash = bytes => createHash('sha256').update(bytes).digest('hex')
    const manifest = { source: 'reviewed-source', bundleSha256: hash(entry), inputs: { 'core.js': { outputSha256: hash(source) } } }
    writeFileSync(join(expected, 'noisemaker-shaders-core.esm.js'), entry)
    writeFileSync(join(expected, 'stable-source', 'core.js'), source)
    writeFileSync(join(expected, 'stable-source-inputs.json'), JSON.stringify(manifest))
    cpSync(expected, installed, { recursive: true })
    assert.deepEqual(stableSourceIdentity(installed, expected), stableSourceIdentity(expected, expected))
    writeFileSync(join(installed, 'stable-source', 'core.js'), 'export const value = 2\n')
    assert.throws(() => stableSourceIdentity(installed, expected), /digest mismatch: core.js/)
    manifest.inputs['core.js'].outputSha256 = hash(readFileSync(join(installed, 'stable-source', 'core.js')))
    writeFileSync(join(installed, 'stable-source-inputs.json'), JSON.stringify(manifest))
    assert.throws(() => stableSourceIdentity(installed, expected), /manifest differs/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
