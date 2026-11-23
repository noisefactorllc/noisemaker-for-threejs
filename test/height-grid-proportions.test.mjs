import { test } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from '../parity/launch-args.mjs'

// Port of upstream shaders/tests/test_height_grid_orientation.mjs (noisemaker
// dacd2b8c..75027859: 75027859 "give the height grid the proportions of the frame")
// onto the PUBLISHED engine bundle through this port's own backends. Seen from
// directly above, heightGrid shows its diffuse image as authored — image right is
// screen right and image top is screen top, with no mirror — and, since 75027859,
// in the proportions of the frame: the grid is gridScale wide and gridScale times
// the frame's height over its width deep (the engine's aspectInv global). The test
// asserts the orientation on a square, a wide and a tall frame, and collects the
// proportions verdict across every backend and frame before deciding, exactly as
// the upstream test does. The adapter executes the served bundle verbatim, so a
// served engine without the fix fails the wide and tall frames.
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
    <title>Noisemaker for Three.js heightGrid proportions</title>
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

      window.__nm_height_grid = async ({ dsl, width, height, backend }) => {
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
  if (requestPath === '/__height_grid_test__.html') {
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

const FIXED_PORTS = [43127, 43128, 43129, 43130, 43131, 43132, 43133, 43134]
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

// A square frame, a wide one and a tall one. The surfaces have the frame's shape.
// The grid is gridScale wide. Each grid here fits inside its frame, with few enough
// particles on a pixel that the summed colors still differ from one sampled point
// to the next. (Upstream's frames, verbatim.)
const frames = [
  { width: 128, height: 128, gridScale: 80, stateSize: 'x128' },
  { width: 256, height: 128, gridScale: 80, stateSize: 'x64' },
  { width: 128, height: 256, gridScale: 50, stateSize: 'x128' },
]
const BACKENDS = ['webgl2', 'three']

// The box of the lit pixels of a frame. (Upstream, verbatim.)
function litBox (png) {
  const box = { x0: png.width, x1: -1, y0: png.height, y1: -1 }
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4
      if (png.data[i] + png.data[i + 1] + png.data[i + 2] < 24) continue
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y)
    }
  }
  assert.ok(box.x1 >= box.x0, 'the frame must contain lit pixels')
  return { ...box, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 }
}

// Points inside the box, toward its corners. Each sample averages the lit pixels
// of the sample window, so the gaps between particles do not count. (Upstream, verbatim.)
function sample (png, box) {
  const dx = Math.round(box.width * 0.27), dy = Math.round(box.height * 0.27)
  const corners = {
    topLeft: [box.x0 + dx, box.y0 + dy], topRight: [box.x1 - dx, box.y0 + dy], bottomLeft: [box.x0 + dx, box.y1 - dy],
  }
  return Object.fromEntries(Object.entries(corners).map(([name, [cx, cy]]) => {
    const sum = [0, 0, 0]
    let lit = 0
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const i = (y * png.width + x) * 4
        if (png.data[i] + png.data[i + 1] + png.data[i + 2] === 0) continue
        for (let c = 0; c < 3; c++) sum[c] += png.data[i + c]
        lit++
      }
    }
    assert.ok(lit > 0, `${name}: the sample window must contain lit pixels`)
    return [name, sum.map(value => value / lit)]
  }))
}
const across = rgb => rgb.topRight[0] - rgb.topLeft[0]
const down = rgb => rgb.bottomLeft[1] - rgb.topLeft[1]

const RENDERER = 'pointsRender(viewMode: perspective, rotateX: 1.5708, density: 100, intensity: 0, inputIntensity: 0)'
const gridDsl = ({ gridScale, stateSize }) => `search synth, points, render
testPattern(pattern: uvMap).write(o1)
solid(color: #ffffff).pointsEmit(stateSize: ${stateSize}).heightGrid(gridScale: ${gridScale}, heightScale: 0, diffuseTex: read(o1)).${RENDERER}.write(o0)
render(o0)`
const referenceDsl = 'search synth\ntestPattern(pattern: uvMap).write(o0)\nrender(o0)'

test('heightGrid seen from above shows its image as authored, in the frame\'s proportions', { timeout: 240000 }, async (t) => {
  let server
  let port
  let browser
  try {
    try {
      ({ server, port } = await startServer())
      browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    } catch (error) {
      if (!isEnvironmentUnavailable(error)) throw error
      process.stderr.write(`[SKIP] heightGrid proportions browser test: ${error.message}\n`)
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
    await page.goto(`${base}/__height_grid_test__.html`)
    await page.waitForFunction('window.__nm_ready === true', null, { timeout: 30000 })

    async function frame ({ dsl, width, height, backend }) {
      const result = await page.evaluate(async job => window.__nm_height_grid(job), { dsl, width, height, backend })
      if (backend === 'webgl2') assert.match(result.name, /webgl|opengl|angle/i, 'requested backend must execute')
      else assert.equal(result.name, 'three', 'requested backend must execute')
      return { width, height, data: result.data }
    }

    // Every backend and frame is measured before the verdict on the proportions.
    const outOfProportion = []
    for (const backend of BACKENDS) {
      // The uvMap reference must vary along both axes, so the orientation
      // comparisons below measure a real gradient, not a flat image.
      const image = sample({ width: frames[0].width, height: frames[0].height, data: (await frame({ dsl: referenceDsl, width: frames[0].width, height: frames[0].height, backend })).data }, { x0: 0, y0: 0, x1: frames[0].width - 1, y1: frames[0].height - 1, width: frames[0].width, height: frames[0].height })
      assert.ok(Math.abs(across(image)) > 48 && Math.abs(down(image)) > 48, `${backend}: the uvMap reference must vary along both axes`)
      for (const { width, height, gridScale, stateSize } of frames) {
        const png = await frame({ dsl: gridDsl({ gridScale, stateSize }), width, height, backend })
        const box = litBox(png)
        const view = sample(png, box)
        const label = `${backend} ${width} x ${height}`
        assert.ok(box.x0 > 0 && box.y0 > 0 && box.x1 < width - 1 && box.y1 < height - 1,
          `${label}: the grid must fit inside the frame (x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1})`)
        assert.ok(Math.sign(across(view)) === Math.sign(across(image)) && Math.abs(across(view)) > 32,
          `${label}: seen from above, image right must be screen right (red ${view.topLeft[0]} -> ${view.topRight[0]})`)
        assert.ok(Math.sign(down(view)) === Math.sign(down(image)) && Math.abs(down(view)) > 32,
          `${label}: seen from above, image top must be screen top (green ${view.topLeft[1]} -> ${view.bottomLeft[1]}, authored ${image.topLeft[1]} -> ${image.bottomLeft[1]})`)
        const shape = width / height
        if (Math.abs(box.width / box.height - shape) > shape * 0.1) {
          outOfProportion.push(`${label}: seen from above, the grid is ${box.width} by ${box.height} pixels, and its frame is ${width} by ${height}`)
        }
      }
    }
    assert.deepEqual(errors, [], 'the browser console must be clean')
    assert.deepEqual(outOfProportion, [])
    page.close().catch(() => {})
    t.diagnostic(JSON.stringify({ backends: BACKENDS, frames: frames.map(f => `${f.width}x${f.height}`) }))
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise(resolveClose => server.close(resolveClose))
  }
})
