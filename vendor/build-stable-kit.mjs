import { build, transform } from 'esbuild'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableSourceIdentity } from '../parity/stable-source-identity.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const vendor = join(root, 'vendor/noisemaker')
const defaultDestination = join(root, 'export-kit/engine')

async function filesIn(directory, prefix = '') {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const name = prefix + entry.name
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), name + '/'))
    else if (entry.isFile()) files.push(name)
    else throw new Error(`Non-regular engine output: ${name}`)
  }
  return files.sort()
}

export async function buildStableKit({ destination = defaultDestination, check = false } = {}) {
  const lock = JSON.parse(await readFile(join(root, 'vendor/engine-source.json'), 'utf8'))
  const source = stableSourceIdentity(vendor, vendor)
  const metadata = JSON.parse(await readFile(join(vendor, 'deployment-meta.json'), 'utf8'))
  if (source.source !== lock.source || metadata.git_hash !== lock.source || metadata.version !== lock.version) {
    throw new Error('Stable kit inputs do not match the reviewed engine source')
  }
  const result = await build({
    absWorkingDir: root, entryPoints: ['vendor/noisemaker/noisemaker-shaders-core.esm.js'],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    minify: true, legalComments: 'inline', metafile: true,
    supported: { 'template-literal': false },
  })
  const inputs = JSON.parse(await readFile(join(vendor, 'stable-source-inputs.json'), 'utf8'))
  const allowed = new Set([
    'vendor/noisemaker/noisemaker-shaders-core.esm.js',
    ...Object.keys(inputs.inputs).map(path => `vendor/noisemaker/stable-source/${path}`),
  ])
  for (const path of Object.keys(result.metafile.inputs)) {
    if (!allowed.has(path.replaceAll('\\', '/'))) throw new Error(`Unreviewed engine bundle input: ${path}`)
  }
  const files = new Map([
    ['noisemaker-shaders-core.esm.min.js', Buffer.from(result.outputFiles[0].contents)],
    ['deployment-meta.json', Buffer.from(JSON.stringify({ version: lock.version, git_hash: lock.source, stable_source_sha256: source.sha256 }, null, 2) + '\n')],
    ['version.js', Buffer.from(`export const version = ${JSON.stringify(lock.version)}\n`)],
  ])
  const manifest = await readFile(join(vendor, 'effects/manifest.json'))
  files.set('effects/manifest.json', manifest)
  for (const id of Object.keys(JSON.parse(manifest)).sort()) {
    const path = `effects/${id}.js`
    const source = await readFile(join(vendor, path), 'utf8')
    // Escaped string literals preserve shader bytes without carrying their
    // source-line whitespace into the generated JavaScript representation.
    const transformed = await transform(source, {
      format: 'esm', target: 'es2022', minifyWhitespace: true,
      supported: { 'template-literal': false }, legalComments: 'inline',
    })
    files.set(path, Buffer.from(transformed.code))
  }
  const existing = await filesIn(destination)
  for (const path of existing) {
    if (!files.has(path)) throw new Error(`Unexpected stable kit output: ${path}`)
  }
  for (const [path, bytes] of files) {
    const target = join(destination, path)
    if (check) {
      if (!bytes.equals(await readFile(target))) throw new Error(`Stable kit output differs: ${path}`)
    } else {
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
    }
  }
  const loader = await readFile(join(root, 'src/engine-browser.js'), 'utf8')
  const anchor = "const EFFECTS_BASE = new URL('../vendor/noisemaker/effects/', import.meta.url)"
  if (loader.split(anchor).length !== 2) throw new Error('Stable kit effect-loader anchor changed')
  const adapted = Buffer.from(loader.replace(anchor, "const EFFECTS_BASE = new URL('../../engine/effects/', import.meta.url)"))
  const overlay = join(dirname(destination), 'overlay/engine-browser.js')
  if (check) {
    if (!adapted.equals(await readFile(overlay))) throw new Error('Stable kit loader overlay differs')
  } else {
    await mkdir(dirname(overlay), { recursive: true })
    await writeFile(overlay, adapted)
  }
  return { source: lock.source, version: lock.version, stableSourceSha256: source.sha256 }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await buildStableKit({ check: process.argv.includes('--check') })))
}
