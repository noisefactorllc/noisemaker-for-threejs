import { test } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from '../parity/launch-args.mjs'

// Port of upstream shaders/tests/test_heightmap_landscape.mjs's frame-shapes
// section (noisemaker 97aa0c62..478f94ea: 478f94ea "give the heightmap terrain
// the proportions of the frame") onto the PUBLISHED engine bundle through this
// port's own backends. Seen from directly above, heightmap3d shows its height
// and diffuse images as authored — image right is screen right and image top is
// screen top, with no mirror — and, since 478f94ea, in the proportions of the
// frame: on a wide frame the terrain spans the volume's width and a centered
// part of its depth, on a tall frame the depth and a centered part of the
// width, and on a square frame all of both. Columns outside the terrain are
// empty. The test asserts the orientation on a square, a wide and a tall frame,
// and collects the proportions verdict across every backend and frame before
// deciding, exactly as the upstream test does. The adapter executes the served
// bundle verbatim, so a served engine without the fix fails the wide and tall
// frames.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
}

const TEST_PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Noisemaker for Three.js heightmap3d proportions</title>
    <script type="importmap">
      { "imports": { "three": "/node_modules/three/build/three.module.js" } }
    </script>
  </head>
  <body>
    <canvas id="c" width="128" height="128"></canvas>
    <script type="module">
      import * as THREE from 'three'
      // Same loaders the parity harness uses: golden = core's createPipeline
      // (WebGL2Backend), candidate = core's Pipeline + ThreeBackend.
      import { compileGraph, createPipeline, loadEffectsForDsl } from '/src/engine-browser.js'
      import { createThreePipeline } from '/src/runtime/create-three-pipeline.js'

      THREE.ColorManagement.enabled = false

      // Read a surface back as bottom-up GL rows, then flip to top-down screen rows
      // (the parity harness's toPng convention) and quantize to 8-bit, so the Node
      // side reads the presented canvas the way a screenshot would.
      function toScreenBytes (flat, width, height) {
        const f = flat instanceof Float32Array ? flat : Float32Array.from(flat)
        const out = new Uint8Array(width * height * 4)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const s = ((height - 1 - y) * width + x) * 4
            const d = (y * width + x) * 4
            for (let c = 0; c < 4; c++) {
              const v = Math.max(0, Math.min(1, f[s + c]))
              out[d + c] = Math.round(v * 255)
            }
          }
        }
        return out
      }

      function readGolden (pipeline, width, height) {
        const backend = pipeline.backend
        const gl = backend.gl
        const surfName = pipeline.graph?.renderSurface || 'o0'
        const surf = pipeline.surfaces?.get(surfName)
        const info = backend.textures?.get(pipeline.frameReadTextures?.get(surfName) ?? surf.read)
        const fbo = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, info.handle, 0)
        const buf = new Float32Array(width * height * 4)
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buf)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.deleteFramebuffer(fbo)
        return buf
      }

      window.__nm_heightmap_landscape = async ({ dsl, width, height, backend }) => {
        const canvas = document.getElementById('c')
        canvas.width = width
        canvas.height = height
        await loadEffectsForDsl(dsl)
        const graph = compileGraph(dsl)
        let pipeline
        let readback
        if (backend === 'three') {
          const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, alpha: true })
          renderer.setPixelRatio(1)
          renderer.setSize(width, height, false)
          pipeline = await createThreePipeline(graph, { renderer, width, height, presentToScreen: false })
          readback = () => pipeline.backend.readPixels().data
        } else {
          pipeline = await createPipeline(graph, { canvas, width, height, preferWebGPU: false })
          readback = () => readGolden(pipeline, width, height)
        }
        try {
          for (let i = 0; i < 4; i++) pipeline.render(0)
          return { name: pipeline.backend.getName().toLowerCase(), data: Array.from(toScreenBytes(readback(), width, height)) }
        } finally {
          pipeline.backend.destroy()
        }
      }
      window.__nm_ready = true
    </script>
  </body>
</html>`

function requestHandler (request, response) {
  const requestPath = decodeURIComponent(request.url.split('?')[0])
  if (requestPath === '/__heightmap_landscape_test__.html') {
    response.setHeader('Content-Type', 'text/html')
    response.end(TEST_PAGE)
    return
  }
  const path = join(repoRoot, requestPath)
  if (!path.startsWith(repoRoot) || !existsSync(path) || !statSync(path).isFile()) {
    response.statusCode = 404
    response.end('not found')
    return
  }
  response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream')
  createReadStream(path).pipe(response)
}

class EnvironmentUnavailable extends Error {}

function isEnvironmentUnavailable (error) {
  if (error instanceof EnvironmentUnavailable) return true
  const message = String(error?.message || '')
  return message.includes('Executable doesn\'t exist') || message.includes('playwright install')
}

const FIXED_PORTS = [43135, 43136, 43137, 43138, 43139, 43140, 43141, 43142]
const LISTEN_TIMEOUT_MS = 5000

function tryListen (port) {
  return new Promise((resolveBind) => {
    const server = createServer(requestHandler)
    let settled = false
    let timer = null
    const settle = (bound) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.removeAllListeners('error')
      if (!bound) server.close()
      resolveBind({ server, bound })
    }
    timer = setTimeout(() => settle(false), LISTEN_TIMEOUT_MS)
    server.once('error', () => settle(false))
    server.listen(port, '127.0.0.1', () => settle(true))
  })
}

async function startServer () {
  const candidates = process.env.NM_TS_PORT
    ? [Number(process.env.NM_TS_PORT), 0, ...FIXED_PORTS]
    : [0, ...FIXED_PORTS]
  for (const port of candidates) {
    const { server, bound } = await tryListen(port)
    if (bound) return { server, port: server.address().port }
  }
  throw new EnvironmentUnavailable(`no permitted loopback port (tried ${candidates.join(', ')})`)
}

// A square frame, a wide one and a tall one. The terrain keeps the frame's
// proportions inside the volume's footprint, so each terrain fits inside its
// frame. (Upstream's frames, verbatim.)
const frameShapes = [
  { width: 128, height: 128, posZ: -40 },
  { width: 256, height: 128, posZ: -40 },
  { width: 128, height: 256, posZ: -120 },
]
const BACKENDS = ['webgl2', 'three']

const topDownDsl = ({ posZ }) => `search synth, synth3d, render
heightmap3d(heightTex: solid(color: #ffffff), tex: testPattern(pattern: uvMap), volumeSize: x16, heightScale: 1)
  .renderLandscape3d(viewMode: perspective, rotateX: 1.5708, posZ: ${posZ}, bgAlpha: 0, ambient: 1, diffuseIntensity: 0, specularIntensity: 0).write(o0)
render(o0)`
const referenceDsl = 'search synth\ntestPattern(pattern: uvMap).write(o0)\nrender(o0)'

// The box of the terrain's pixels; the background is transparent. (Upstream, verbatim.)
function terrainBox (frame) {
  const { width, height, data } = frame
  const box = { x0: width, x1: -1, y0: height, y1: -1 }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y)
    }
  }
  return { ...box, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 }
}

// Points toward the corners: of the whole frame in the authored image, of the
// terrain in the view. Each sample reads one pixel, so the terrain's lit faces
// must differ from one sampled point to the next. (Upstream, verbatim.)
function sample (frame, area) {
  const { width, data } = frame
  const dx = Math.round((area.x1 - area.x0 + 1) * 0.27), dy = Math.round((area.y1 - area.y0 + 1) * 0.27)
  const at = (x, y) => {
    const i = (y * width + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  return {
    topLeft: at(area.x0 + dx, area.y0 + dy),
    topRight: at(area.x1 - dx, area.y0 + dy),
    bottomLeft: at(area.x0 + dx, area.y1 - dy),
  }
}
const across = rgb => rgb.topRight[0] - rgb.topLeft[0]
const down = rgb => rgb.bottomLeft[1] - rgb.topLeft[1]

test('heightmap3d seen from above shows its images as authored, in the frame\'s proportions', { timeout: 240000 }, async (t) => {
  let server
  let port
  let browser
  try {
    try {
      ({ server, port } = await startServer())
      browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    } catch (error) {
      if (!isEnvironmentUnavailable(error)) throw error
      process.stderr.write(`[SKIP] heightmap3d proportions browser test: ${error.message}\n`)
      t.skip(error.message)
      return
    }
    const base = `http://127.0.0.1:${port}`
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(`${base}/__heightmap_landscape_test__.html`)
    await page.waitForFunction('window.__nm_ready === true', null, { timeout: 30000 })

    async function frame ({ dsl, width, height, backend }) {
      const result = await page.evaluate(async job => window.__nm_heightmap_landscape(job), { dsl, width, height, backend })
      if (backend === 'webgl2') assert.match(result.name, /webgl|opengl|angle/i, 'requested backend must execute')
      else assert.equal(result.name, 'three', 'requested backend must execute')
      return { width, height, data: result.data }
    }

    // Every backend and frame is measured before the verdict on the proportions.
    const outOfProportion = []
    for (const backend of BACKENDS) {
      // The uvMap reference must vary along both axes, so the orientation
      // comparisons below measure a real gradient, not a flat image.
      const square = frameShapes[0]
      const image = sample(await frame({ dsl: referenceDsl, width: square.width, height: square.height, backend }),
        { x0: 0, y0: 0, x1: square.width - 1, y1: square.height - 1 })
      assert.ok(Math.abs(across(image)) > 64 && Math.abs(down(image)) > 64, `${backend}: the uvMap reference must vary along both axes`)
      for (const { width, height, posZ } of frameShapes) {
        const view = await frame({ dsl: topDownDsl({ posZ }), width, height, backend })
        const box = terrainBox(view)
        const label = `${backend} ${width} x ${height}`
        assert.ok(box.x1 >= box.x0, `${label}: the terrain must be visible`)
        assert.ok(box.x0 > 0 && box.y0 > 0 && box.x1 < width - 1 && box.y1 < height - 1,
          `${label}: the terrain must fit inside the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        assert.ok(Math.abs(box.x0 + box.x1 - (width - 1)) <= 3 && Math.abs(box.y0 + box.y1 - (height - 1)) <= 3,
          `${label}: the terrain must be centered in the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        const sampled = sample(view, box)
        assert.ok(Math.sign(across(sampled)) === Math.sign(across(image)) && Math.abs(across(sampled)) > 64,
          `${label}: seen from above, image right must be screen right (red ${sampled.topLeft[0]} -> ${sampled.topRight[0]})`)
        assert.ok(Math.sign(down(sampled)) === Math.sign(down(image)) && Math.abs(down(sampled)) > 64,
          `${label}: seen from above, image top must be screen top (green ${sampled.topLeft[1]} -> ${sampled.bottomLeft[1]}, authored ${image.topLeft[1]} -> ${image.bottomLeft[1]})`)
        assert.ok(Math.abs(sampled.bottomLeft[0] - sampled.topLeft[0]) <= 24 && Math.abs(sampled.topRight[1] - sampled.topLeft[1]) <= 24,
          `${label}: seen from above, the image must not be rotated`)
        const shape = width / height
        if (Math.abs(box.width / box.height - shape) > shape * 0.1) {
          outOfProportion.push(`${label}: seen from above, the terrain is ${box.width} by ${box.height} pixels, and its frame is ${width} by ${height}`)
        }
      }
    }
    assert.deepEqual(errors, [], 'the browser console must be clean')
    assert.deepEqual(outOfProportion, [])
    page.close().catch(() => {})
    t.diagnostic(JSON.stringify({ backends: BACKENDS, frames: frameShapes.map(f => `${f.width}x${f.height}`) }))
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise(resolveClose => server.close(resolveClose))
  }
})
