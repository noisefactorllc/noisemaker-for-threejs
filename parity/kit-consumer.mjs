// kit-consumer.mjs — served-kit host-workflow qualification driver.
//
// Assembles the SERVED export kit into an isolated consumer directory, then exercises
// the kit's own `index.html` host page in headless Chromium:
//
//   PLAYWRIGHT_BROWSERS_PATH=<dir> node parity/kit-consumer.mjs <outDir> [builtKitDir]
//
// The consumer tree is downloaded from the production distribution, never from this
// checkout by default, so the run qualifies the artifact a real kit consumer receives.
// An explicit builtKitDir qualifies an assembled candidate before publication:
//
// 1. Fetch `deployment-meta.json` (kit version, source SHA) and `kit.json` (per-file
//    sha256/bytes inventory) from kits.noisedeck.app, then download every inventory file
//    and verify each byte count and SHA-256 against the inventory (hard fail on mismatch).
// 2. Read the inventoried stable engine without replacing it. Require its source and
//    core digest to match the checkout's generated kit engine, and verify every
//    mini-bundle listed in its manifest.
// 3. Build `index.html` from the kit's own `index.template.html` with the placeholders
//    the exporter injects filled in (program name, DSL, engine version), using the
//    committed `parity/programs/adjust.dsl` as the program. Build `index-invalid.html`
//    the same way with the DSL's write target replaced by the out-of-range `o9`.
// 4. Serve the tree over loopback HTTP and run two legs through the kit page itself:
//      - valid: page reaches status `running`, canvas readback is a live non-constant
//        image, zero console errors, zero page errors;
//      - invalid: page shows the on-screen failure with the engine's positioned
//        SyntaxError diagnostic; the console error is the page's designed
//        "Noisedeck export failed" channel (asserted present, not an error).
// 5. After the browser closes, delete the consumer directory (the kit's removal path:
//    the distribution is a plain folder) and verify it is gone.
//
// The driver exits 0 only when the gate passes: every leg completed as asserted, the
// readback is non-constant, both valid-leg error channels are silent, the invalid leg
// surfaces "could not start" with a positioned SyntaxError naming the offending surface,
// and the removal left no tree. results.json (per-leg measurements, screenshot hashes,
// inventory and engine hashes, gate verdict) lands in <outDir>.
import { chromium } from '@playwright/test'
import { parityHeadless, chromiumLaunchArgs } from './launch-args.mjs'
import { startLoopbackServer } from './loopback-server.mjs'
import { kitConsumerPassed } from './kit-consumer-verdict.mjs'
import { createHash } from 'node:crypto'
import http from 'node:http'
import { mkdirSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = process.argv[2] ? resolve(process.argv[2]) : null
const builtKitDir = process.argv[3] ? resolve(process.argv[3]) : null
if (!outDir) {
  console.error('usage: PLAYWRIGHT_BROWSERS_PATH=<dir> node parity/kit-consumer.mjs <outDir> [builtKitDir]')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const KIT_BASE = 'https://kits.noisedeck.app/threejs/0'
const HERE = fileURLToPath(new URL('.', import.meta.url))

const out = {
  kit: {}, engine: {}, program: {}, valid: {}, invalid: {}, removal: {},
  screenshots: {}, gate: [], steps: [],
}
const step = (name, ok, detail) => {
  out.steps.push({ name, ok, detail: detail || null })
  if (!ok) out.gate.push(`step ${name} failed`)
}

// ---- 1. served kit inventory -----------------------------------------------------------
const kitJson = builtKitDir
  ? JSON.parse(readFileSync(join(builtKitDir, 'kit.json')))
  : await (await fetch(`${KIT_BASE}/kit.json`)).json()
out.kit.deploymentMeta = builtKitDir
  ? { localBuild: true, source: kitJson.source }
  : await (await fetch(`${KIT_BASE}/deployment-meta.json`)).json()
out.kit.kitVersion = kitJson.version
out.kit.sourceSha = kitJson.source && kitJson.source.sha

const consumer = join(outDir, 'consumer')
for (const f of kitJson.files) {
  let bytes
  if (builtKitDir) bytes = readFileSync(join(builtKitDir, f.path))
  else {
    const res = await fetch(`${KIT_BASE}/${f.path}`)
    if (!res.ok) throw new Error(`kit file ${f.path}: HTTP ${res.status}`)
    bytes = Buffer.from(await res.arrayBuffer())
  }
  const hash = sha256(bytes)
  const ok = hash === f.sha256 && bytes.length === f.bytes
  if (!ok) throw new Error(`kit file ${f.path}: expected sha ${f.sha256}/${f.bytes}B, got ${hash}/${bytes.length}B`)
  const dest = join(consumer, f.path)
  mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true })
  writeFileSync(dest, bytes)
}
const okFiles = kitJson.files.length
step('kit-inventory', true, `${okFiles}/${okFiles} served files match kit.json sha256+bytes`)

// ---- 2. the kit's own stable engine ----------------------------------------------------
if (kitJson.engineSource !== 'kit') throw new Error('The served kit does not carry its stable engine')
const engineDir = join(consumer, 'engine')
const effectsDir = join(engineDir, 'effects')
const engineVersion = JSON.parse(readFileSync(join(engineDir, 'deployment-meta.json')))
const expectedEngine = join(HERE, '../export-kit/engine')
const expectedMetadata = JSON.parse(readFileSync(join(expectedEngine, 'deployment-meta.json')))
if (JSON.stringify(engineVersion) !== JSON.stringify(expectedMetadata)) throw new Error('Kit engine source differs from the reviewed candidate')
out.engine.deploymentMeta = engineVersion
const coreMin = readFileSync(join(engineDir, 'noisemaker-shaders-core.esm.min.js'))
out.engine.coreMinSha256 = sha256(coreMin)
out.engine.coreMinBytes = coreMin.length
step('engine-source', out.engine.coreMinSha256 === sha256(readFileSync(join(expectedEngine, 'noisemaker-shaders-core.esm.min.js'))),
  `stable core sha ${out.engine.coreMinSha256}`)
const manifestBytes = readFileSync(join(effectsDir, 'manifest.json'))
out.engine.manifestSha256 = sha256(manifestBytes)
const effectIds = Object.keys(JSON.parse(manifestBytes))
for (const id of effectIds) {
  const bytes = readFileSync(join(effectsDir, `${id}.js`))
  if (!bytes.equals(readFileSync(join(expectedEngine, 'effects', `${id}.js`)))) throw new Error(`Kit effect source differs: ${id}`)
}
const countBundles = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? countBundles(join(dir, e.name))
    : (e.name.endsWith('.js') ? [e.name] : []))
const bundleCount = countBundles(effectsDir).length
step('engine-bundles', bundleCount === effectIds.length,
  `${bundleCount} bundle files vs ${effectIds.length} manifest entries; manifest sha ${out.engine.manifestSha256}`)

// ---- 3. build the injected pages from the kit's own template ---------------------------
const template = readFileSync(join(consumer, 'index.template.html'), 'utf8')
const dsl = readFileSync(join(HERE, 'programs/adjust.dsl'), 'utf8').trim()
const invalidDsl = dsl.replace('.write(o0)', '.write(o9)')
if (invalidDsl === dsl || !invalidDsl.includes('.write(o9)')) throw new Error('invalid-DSL mutation failed')
out.program.name = 'kit-qualification'
out.program.dsl = dsl
out.program.invalidDsl = invalidDsl
out.program.source = 'parity/programs/adjust.dsl (committed at the qualification commit)'

const fill = (programDsl) => template
  .replace(/\{\{NM_PROGRAM_NAME_HTML\}\}/g, 'kit-qualification')
  .replace(/\{\{NM_PROGRAM_NAME_JSON\}\}/g, JSON.stringify('kit-qualification'))
  .replace(/\{\{NM_DSL_JSON\}\}/g, JSON.stringify(programDsl))
  .replace(/\{\{NM_ENGINE_VERSION\}\}/g, engineVersion.version)
  .replace(/\{\{NM_EFFECT_LIST\}\}/g, '- `synth/noise`\n- `filter/adjust`')
if (fill(dsl) === template) throw new Error('template placeholders were not substituted')
writeFileSync(join(consumer, 'index.html'), fill(dsl))
writeFileSync(join(consumer, 'index-invalid.html'), fill(invalidDsl))

// ---- 4. run both legs through the kit page --------------------------------------------
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain' }
const { server, port } = await startLoopbackServer(() => http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (p.endsWith('/')) p += 'index.html'
  try {
    const data = readFileSync(join(consumer, p))
    res.writeHead(200, { 'content-type': mime[extname(p)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return }
    res.writeHead(404)
    res.end('nf')
  }
}))
const base = `http://127.0.0.1:${port}`

const browser = await chromium.launch({ headless: parityHeadless(), args: chromiumLaunchArgs() })
out.host = { platform: process.platform, arch: process.arch, browserVersion: browser.version() }
const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
const consoleErrors = { valid: [], invalid: [] }
const pageErrors = { valid: [], invalid: [] }
let leg = 'valid'
page.on('console', (m) => { if (m.type() === 'error') consoleErrors[leg].push(m.text().slice(0, 400)) })
page.on('pageerror', (e) => pageErrors[leg].push(String(e).slice(0, 400)))

const settled = (timeout) => page.waitForFunction(() => {
  const s = document.getElementById('status')
  return s && (s.classList.contains('is-done') || s.classList.contains('is-failed'))
}, null, { timeout })

try {
  await page.goto(`${base}/index.html`, { waitUntil: 'load' })
  await settled(60000)
  const failed = await page.evaluate(() => document.getElementById('status').classList.contains('is-failed'))
  if (failed) {
    out.valid.render = 'failed'
    out.valid.error = await page.evaluate(() => document.getElementById('err').textContent.slice(0, 600))
    step('valid-render', false, 'kit page failed to start the valid program')
  } else {
    out.valid.render = 'running'
    await page.waitForTimeout(1500)
    out.valid.readback = await page.evaluate(() => {
      const c = document.getElementById('nm-canvas')
      const gl = c.getContext('webgl2', { preserveDrawingBuffer: true })
      if (!gl) return { error: 'no webgl2 handle' }
      const buf = new Uint8Array(4 * 64 * 64)
      gl.readPixels(Math.floor(c.width / 4), Math.floor(c.height / 4), 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      let min = 255, max = 0, sum = 0
      for (let i = 0; i < buf.length; i += 4) {
        const v = (buf[i] + buf[i + 1] + buf[i + 2]) / 3
        sum += v
        if (v < min) min = v
        if (v > max) max = v
      }
      const debug = gl.getExtension('WEBGL_debug_renderer_info')
      return { min, max, mean: sum / (buf.length / 4),
        gpuRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null }
    })
    step('valid-render', out.valid.readback.max !== undefined && out.valid.readback.min !== out.valid.readback.max,
      `readback ${JSON.stringify(out.valid.readback)}`)
  }
  const s1 = await page.screenshot()
  out.screenshots.render = { sha256: sha256(s1), bytes: s1.length }
  out.valid.consoleErrors = consoleErrors.valid
  out.valid.pageErrors = pageErrors.valid
  step('valid-leg-clean', consoleErrors.valid.length === 0 && pageErrors.valid.length === 0,
    `console=${consoleErrors.valid.length} page=${pageErrors.valid.length}`)

  leg = 'invalid'
  await page.goto(`${base}/index-invalid.html`, { waitUntil: 'load' })
  await settled(30000)
  out.invalid = {
    failed: await page.evaluate(() => document.getElementById('status').classList.contains('is-failed')),
    errorShown: await page.evaluate(() => !document.getElementById('err').hidden),
    text: await page.evaluate(() => document.getElementById('err').textContent.slice(0, 800)),
  }
  out.invalid.consoleErrors = consoleErrors.invalid.map((t) => t.slice(0, 200))
  out.invalid.pageErrors = pageErrors.invalid
  const diagOk = out.invalid.failed && out.invalid.errorShown &&
    out.invalid.text.includes('could not start') && out.invalid.text.includes('SyntaxError') &&
    out.invalid.text.includes("'o9'") && /line \d+ col \d+/.test(out.invalid.text)
  step('invalid-diagnostic', diagOk, (out.invalid.text.split('\n').slice(0, 2).join(' ')).slice(0, 300))
  const s2 = await page.screenshot()
  out.screenshots.invalid = { sha256: sha256(s2), bytes: s2.length }
} catch (e) {
  out.gate.push(`driver error: ${String(e && e.stack || e).slice(0, 500)}`)
}

await browser.close()
server.close()

// ---- 5. removal: the kit is a plain folder --------------------------------------------
rmSync(consumer, { recursive: true, force: true })
let removed = !existsSync(join(consumer, 'index.html'))
out.removal.removed = removed
out.removal.detail = removed ? 'consumer tree deleted; index.html no longer readable' : 'index.html still readable after removal'
step('removal', removed, out.removal.detail)

const pass = kitConsumerPassed(out)
out.gate = pass ? [] : out.gate.concat(['one or more steps failed'])
out.verdict = pass ? 'pass' : 'fail'
writeFileSync(join(outDir, 'results.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
process.exit(out.verdict === 'pass' ? 0 : 1)
