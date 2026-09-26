// installed-consumer.mjs — installed-developer-workflow qualification driver (GAP-002).
//
// Packs nothing itself: the caller installs the packed npm tarball into an ISOLATED consumer
// directory (`npm init -y && npm i <tarball> three@<version>`), runs `bash vendor/fetch.sh`
// inside the installed package (node_modules/noisemaker-for-threejs) so the engine bytes sit
// next to the adapter, then runs this driver:
//
//   PLAYWRIGHT_BROWSERS_PATH=<dir> node parity/installed-consumer.mjs \
//     <consumerDir> <outDir> <threeVersion>
//
// The driver serves the consumer tree over loopback HTTP, opens an import-mapped page that
// imports the ADAPTER FROM THE INSTALLED PACKAGE (`/node_modules/noisemaker-for-threejs/src/
// index.js`) and three from the consumer's own node_modules, and exercises the installed
// developer workflow end to end: NoisemakerTexture on a lit mesh (compile, update, readback),
// a NoisemakerPass inside EffectComposer, a composer resize (480×320), an invalid DSL program
// (structured diagnostic expected), recovery via a fresh valid compile + render, and dispose
// (adapter + pass pipelines, renderer dispose + context loss, three's own resource counters
// before/after). Screenshots and a results.json land in <outDir>; the driver exits 0 only when
// the enforced gate passes: every step completed (no stepError), the driver raised no error,
// the page logged zero console errors, and dispose left the renderer renderable
// (postDisposeRenderThrows false) — see the gate block near the end of this file.
//
// Steps are registered in the page (`window.__steps`) and invoked by name — Playwright cannot
// serialize function arguments, so each step runs through one `evaluate(key)`.
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { extname, join, resolve } from 'node:path'

const consumerDir = resolve(process.argv[2])
const outDir = resolve(process.argv[3])
const threeVersion = process.argv[4]
mkdirSync(outDir, { recursive: true })

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm',
}

// Minimal static server rooted at the consumer dir.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = join(consumerDir, decodeURIComponent(url.pathname))
  try {
    const body = readFileSync(p)
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('nf')
  }
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port
const base = `http://127.0.0.1:${port}`

const results = { threeVersion, base, steps: {}, errors: [] }

const page_html = `<!doctype html>
<html><head><meta charset="utf-8"><style>body{margin:0}</style>
<script type="importmap">
{ "imports": {
    "three": "/node_modules/three/build/three.module.js",
    "three/addons/": "/node_modules/three/examples/jsm/"
} }
</script>
</head><body>
<script type="module">
import * as THREE from 'three'
import { NoisemakerTexture, NoisemakerPass } from '/node_modules/noisemaker-for-threejs/src/index.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'

const stats = (px) => {
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < px.data.length; i++) {
    const v = px.data[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { width: px.width, height: px.height, samples: px.data.length,
    min: Number(min.toFixed(6)), max: Number(max.toFixed(6)),
    mean: Number((sum / px.data.length).toFixed(6)) }
}

const S = window.__state = {
  THREE, NoisemakerTexture, NoisemakerPass, EffectComposer, RenderPass,
  consoleCap: [], originalConsoleError: console.error,
}
console.error = (...a) => { S.consoleCap.push(a.map(String).join(' ')); S.originalConsoleError(...a) }

window.__steps = {
  buildScene() {
    S.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
    S.renderer.setPixelRatio(1)
    S.renderer.setSize(320, 240)
    S.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    document.body.appendChild(S.renderer.domElement)
    S.scene = new THREE.Scene()
    S.camera = new THREE.PerspectiveCamera(50, 320 / 240, 0.1, 100)
    S.camera.position.set(0, 0, 3)
    S.scene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2, 3, 4)
    S.scene.add(key)
    S.nmTex = new NoisemakerTexture(S.renderer, { width: 128, height: 128 })
    S.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ map: S.nmTex.texture, roughness: 0.6 })
    )
    S.scene.add(S.mesh)
    return 'scene built'
  },
  async compileTextureOnMesh() {
    await S.nmTex.compile('search synth, filter\\nnoise(seed: 3, scaleX: 20, scaleY: 20).bloom().write(o0)\\nrender(o0)')
    S.nmTex.update(0.25)
    return 'compiled+updated'
  },
  renderMesh() {
    S.renderer.render(S.scene, S.camera)
    S.renderer.render(S.scene, S.camera)
    return 'scene rendered twice'
  },
  textureStats() {
    return stats(S.nmTex.readPixels())
  },
  meshGpuReadback() {
    const gl = S.renderer.getContext()
    S.renderer.setRenderTarget(null)
    const data = new Uint8Array(320 * 240 * 4)
    gl.readPixels(0, 0, 320, 240, gl.RGBA, gl.UNSIGNED_BYTE, data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return { mean: Number((sum / data.length).toFixed(3)) }
  },
  async setupPass() {
    S.composer = new EffectComposer(S.renderer)
    S.composer.addPass(new RenderPass(S.scene, S.camera))
    S.nmPass = new NoisemakerPass(S.renderer, { width: 320, height: 240, loopDuration: 4 })
    await S.nmPass.compile('search synth, filter\\nnoise(seed: 5).bloom().write(o0)\\nrender(o0)')
    S.composer.addPass(S.nmPass)
    return 'pass compiled'
  },
  renderPass() {
    S.composer.render()
    return 'composer.render done'
  },
  canvasMean() {
    const gl = S.renderer.getContext()
    S.renderer.setRenderTarget(null)
    const w = S.renderer.domElement.width, h = S.renderer.domElement.height
    const data = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return Number((sum / data.length).toFixed(3))
  },
  resize() {
    S.renderer.setSize(480, 320)
    S.composer.setSize(480, 320)
    S.camera.aspect = 480 / 320
    S.camera.updateProjectionMatrix()
    return { canvasW: S.renderer.domElement.width, canvasH: S.renderer.domElement.height }
  },
  async invalidDsl() {
    try {
      await S.nmTex.compile('search synth, filter\\nnoise(scaleX: 10).write(o9)\\nrender(o9)')
      return { threw: false }
    } catch (e) {
      const d = e.diagnostic || null
      return {
        threw: true, name: e.name, message: String(e.message).slice(0, 300),
        diagnostic: d ? { code: d.code, line: d.location && d.location.line,
          column: d.location && d.location.column,
          spanStart: d.span && d.span.start, spanEnd: d.span && d.span.end } : null,
      }
    }
  },
  async recovery() {
    await S.nmTex.compile('search synth, filter\\nnoise(seed: 7, scaleX: 30, scaleY: 30).adjust(rotation: 90).write(o0)\\nrender(o0)')
    S.nmTex.update(0.5)
    S.mesh.material.map = S.nmTex.texture
    S.composer.render()
    return 'recompiled and rendered after failure'
  },
  recoveryStats() {
    return stats(S.nmTex.readPixels())
  },
  dispose() {
    const before = {
      textures: S.renderer.info.memory.textures,
      geometries: S.renderer.info.memory.geometries,
      programs: S.renderer.info.programs ? S.renderer.info.programs.length : null,
    }
    S.nmTex.dispose()
    S.nmPass.dispose()
    const after = {
      textures: S.renderer.info.memory.textures,
      geometries: S.renderer.info.memory.geometries,
      programs: S.renderer.info.programs ? S.renderer.info.programs.length : null,
    }
    let postDisposeRenderThrows = false
    try { S.composer.render() } catch (e) { postDisposeRenderThrows = true }
    S.renderer.dispose()
    S.renderer.forceContextLoss()
    return { before, after, disposed: true, postDisposeRenderThrows }
  },
  hostInfo() {
    const gl = document.createElement('canvas').getContext('webgl2')
    const dbg = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null
    return {
      userAgent: navigator.userAgent,
      webgl2: !!gl,
      gpuRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      gpuVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
      threeRevision: THREE.REVISION,
    }
  },
}

window.__ready = true
</script>
</body></html>`

writeFileSync(join(consumerDir, 'gap002-page.html'), page_html)

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-gpu-sandbox',
  ],
})
let page
try {
  page = await browser.newPage({ viewport: { width: 640, height: 480 } })
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text()) })
  await page.goto(base + '/gap002-page.html')
  await page.waitForFunction('window.__ready === true', null, { timeout: 30000 })

  const shot = async (name) => {
    const buf = await page.screenshot()
    writeFileSync(join(outDir, name + '.png'), buf)
    return sha256(buf)
  }
  // Run a named page-side step with full error capture.
  const step = async (key) => {
    const r = await page.evaluate(async (k) => {
      try {
        return { ok: true, result: await window.__steps[k]() }
      } catch (e) {
        return {
          ok: false, name: e && e.name, message: e && e.message, stack: e && e.stack,
          raw: (() => { try { return String(e) } catch { return undefined } })(),
          keys: e && typeof e === 'object' ? Object.keys(e) : undefined,
          code: e && e.code,
          diagnostics: e && e.diagnostics ? JSON.parse(JSON.stringify(e.diagnostics)) : undefined,
          diagnostic: e && e.diagnostic ? JSON.parse(JSON.stringify(e.diagnostic)) : undefined,
        }
      }
    }, key)
    if (!r.ok) { results.steps[key] = { stepError: r }; results.errors.push(key + ': ' + r.message) }
    else results.steps[key] = r.result
    return r
  }

  results.host = await page.evaluate(() => window.__steps.hostInfo())
  results.steps.pageLoad = 'ok'

  // --- Step 1: texture on a mesh ---
  await step('buildScene')
  await step('compileTextureOnMesh')
  await step('renderMesh')
  results.steps.meshRenderShot = await shot('1-texture-on-mesh')
  await step('meshGpuReadback')
  await step('textureStats')

  // --- Step 2: EffectComposer pass ---
  await step('setupPass')
  await step('renderPass')
  results.steps.passShot = await shot('2-effect-composer-pass')

  // --- Step 3: resize ---
  await step('resize')
  await step('renderPass')
  const m1 = await step('canvasMean')
  results.steps.resizeRender1Mean = m1.ok ? m1.result : null
  await step('renderPass')
  const m2 = await step('canvasMean')
  results.steps.resizeRender2Mean = m2.ok ? m2.result : null
  results.steps.resizeShot = await shot('3-after-resize')

  // --- Step 4: invalid DSL diagnostics ---
  await step('invalidDsl')

  // --- Step 5: recovery (valid DSL after the failure) ---
  await step('recovery')
  results.steps.recoveryShot = await shot('4-recovery-after-invalid-dsl')
  await step('recoveryStats')

  // --- Step 6: dispose + cleanup ---
  await step('dispose')
  results.steps.disposeShot = await shot('5-after-dispose')
  results.steps.pageConsoleCap = await page.evaluate(() => window.__state.consoleCap)
  results.consoleErrors = consoleErrors
} catch (err) {
  results.errors.push(String(err && err.stack ? err.stack : err))
} finally {
  try { await browser.close() } catch { /* already closed */ }
  server.close()
}

// Enforced gate: the run passes only when every step completed, the driver
// raised no errors, the browser logged no console errors, and dispose left the
// renderer renderable (postDisposeRenderThrows false).
const failedSteps = Object.entries(results.steps)
  .filter(([key, v]) => key !== 'pageConsoleCap' && v && typeof v === 'object' && v.stepError)
  .map(([key]) => key)
const dispose = results.steps.dispose || {}
const gate = []
if (failedSteps.length) gate.push('failed steps: ' + failedSteps.join(', '))
if (results.errors.length) gate.push('driver errors: ' + results.errors.join(' | '))
if (results.consoleErrors.length) gate.push('console errors: ' + results.consoleErrors.join(' | '))
if (dispose.postDisposeRenderThrows !== false) gate.push('postDisposeRenderThrows is ' + dispose.postDisposeRenderThrows)
results.ok = gate.length === 0
results.gate = gate

writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify({ ok: results.ok, threeVersion, gate: results.gate }, null, 1))
process.exit(results.ok ? 0 : 1)
