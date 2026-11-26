import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = new URL('./', import.meta.url)
const out = new URL('noisemaker/', here)
const lock = JSON.parse(await readFile(new URL('engine-source.json', here), 'utf8'))
const patch = await readFile(new URL('stable-core.patch', here), 'utf8')
const hash = text => createHash('sha256').update(text).digest('hex')

export function applyPatch(source, patchText) {
  const lines = source.split('\n')
  const result = []
  let cursor = 0
  for (const section of patchText.split(/(?=^@@ )/m).slice(1)) {
    const [header, ...body] = section.replace(/\n$/, '').split('\n')
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header)
    if (!match) throw new Error('Invalid stable-core patch header')
    const start = Number(match[1]) - 1
    if (start < cursor) throw new Error('Overlapping stable-core patch hunks')
    result.push(...lines.slice(cursor, start))
    cursor = start
    let removed = 0, added = 0
    for (const line of body) {
      const marker = line[0]
      const text = line.slice(1)
      if (marker === ' ' || marker === '-') {
        if (lines[cursor++] !== text) throw new Error('Stable-core patch context mismatch')
        removed++
      }
      if (marker === ' ' || marker === '+') { result.push(text); added++ }
      if (![' ', '-', '+'].includes(marker)) throw new Error('Invalid stable-core patch line')
    }
    if (removed !== Number(match[2] ?? 1) || added !== Number(match[4] ?? 1)) {
      throw new Error('Stable-core patch length mismatch')
    }
  }
  return [...result, ...lines.slice(cursor)].join('\n')
}

const patches = new Map()
for (const section of patch.split(/(?=^--- a\/)/m).filter(Boolean)) {
  const path = /^--- a\/(.+)\n/.exec(section)?.[1]
  if (!path || patches.has(path)) throw new Error('Invalid stable-core patch path')
  patches.set(path, section)
}

async function fetchSource(revision, path) {
  const url = new URL(`noisemaker/source-cache/${revision}/${path}`, here)
  try { return await readFile(url, 'utf8') } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const response = await fetch(`https://raw.githubusercontent.com/noisefactorllc/noisemaker/${revision}/${path}`, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Source fetch ${path}: HTTP ${response.status}`)
  const source = await response.text()
  await mkdir(dirname(fileURLToPath(url)), { recursive: true })
  await writeFile(url, source)
  return source
}

async function buildStableCore() {
  const metadata = JSON.parse(await readFile(new URL('deployment-meta.json', out), 'utf8'))
  if (metadata.version !== lock.version || metadata.git_hash !== lock.source) {
    throw new Error('Engine publication does not match the reviewed stable-source pin')
  }
  const registryText = await fetchSource(lock.source, 'shaders/src/stability.js')
  if (hash(registryText) !== lock.inputs['shaders/src/stability.js']) throw new Error('Stability registry digest mismatch')
  // The registry has no imports. Evaluate the pinned upstream module locally.
  const registryURL = new URL('stability.mjs', out)
  await writeFile(registryURL, registryText)
  const { SURFACE } = await import(registryURL.href)
  const excluded = new Set(Object.keys(SURFACE.modules).map(path => `shaders/src/${path}`))
  const inputs = {}
  const entry = [
    "export * from './stable-source/shaders/src/index.js'",
    "export * from './stable-source/demo/shaders/lib/demo-ui.js'",
    "export { EffectSelect } from './stable-source/demo/shaders/lib/effect-select.js'",
    "export { ToggleSwitch } from './stable-source/demo/shaders/lib/toggle-switch.js'",
  ].join('\n') + '\n'
  for (const [path, expected] of Object.entries(lock.inputs)) {
    if (excluded.has(path)) throw new Error(`Excluded engine module: ${path}`)
    const override = lock.overrides[path]
    const revision = override ? lock.baseline : lock.source
    let contents = await fetchSource(revision, path)
    const inputSha256 = hash(contents)
    if (inputSha256 !== expected) throw new Error(`Source input digest mismatch: ${path}`)
    if (override) {
      if (inputSha256 !== override.inputSha256) throw new Error(`Source digest mismatch: ${path}`)
      contents = applyPatch(contents, patches.get(path))
      if (hash(contents) !== override.outputSha256) throw new Error(`Derived source digest mismatch: ${path}`)
    }
    // Materialize the palette JSON as ESM, as the published bundle does.
    // This preserves the existing browser floor without adding a build tool
    // to installed consumers.
    let destination = path
    if (path.endsWith('.json')) {
      contents = `export default ${JSON.stringify(JSON.parse(contents))}\n`
      destination += '.js'
    } else {
      contents = contents.replace(/(from\s+['"])([^'"]+\.json)(['"])\s+with\s*\{\s*type:\s*['"]json['"]\s*\}/g, '$1$2.js$3')
    }
    const url = new URL(`stable-source/${destination}`, out)
    await mkdir(dirname(fileURLToPath(url)), { recursive: true })
    await writeFile(url, contents)
    inputs[destination] = { revision, inputSha256, outputSha256: hash(contents) }
  }
  for (const path of Object.keys(lock.overrides)) {
    if (!inputs[path]) throw new Error(`Unused stable-source override: ${path}`)
  }
  const bundle = entry
  await writeFile(new URL('noisemaker-shaders-core.esm.js', out), bundle)
  await writeFile(new URL('stable-source-inputs.json', out), JSON.stringify({ source: lock.source, bundleSha256: hash(bundle), inputs }, null, 2) + '\n')
  console.log(`[vendor] stable core ${lock.version}: ${hash(bundle)}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildStableCore()
