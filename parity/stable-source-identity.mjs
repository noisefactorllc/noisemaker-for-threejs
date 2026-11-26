import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export function stableSourceIdentity(directory, expectedDirectory) {
  const manifestName = 'stable-source-inputs.json'
  const bytes = readFileSync(join(directory, manifestName))
  if (!bytes.equals(readFileSync(join(expectedDirectory, manifestName)))) {
    throw new Error('Installed stable-source manifest differs from the reviewed candidate')
  }
  const manifest = JSON.parse(bytes)
  const entry = readFileSync(join(directory, 'noisemaker-shaders-core.esm.js'))
  if (hash(entry) !== manifest.bundleSha256) throw new Error('Stable-source entry digest mismatch')
  const identity = createHash('sha256').update(bytes).update(entry)
  for (const [path, record] of Object.entries(manifest.inputs).sort(([a], [b]) => a.localeCompare(b))) {
    const source = readFileSync(join(directory, 'stable-source', path))
    if (hash(source) !== record.outputSha256) throw new Error(`Stable-source digest mismatch: ${path}`)
    identity.update(path).update(source)
  }
  return { source: manifest.source, sha256: identity.digest('hex') }
}
