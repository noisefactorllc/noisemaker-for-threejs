import { test } from 'node:test'
import assert from 'node:assert'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from '../parity/launch-args.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
}

function requestHandler (request, response) {
  const requestPath = decodeURIComponent(request.url.split('?')[0])
  if (requestPath === '/__frame_export_test__.html') {
    response.setHeader('Content-Type', 'text/html')
    response.end('<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>')
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

// Setup failures that mean THIS ENVIRONMENT cannot run the browser harness at
// all: the loopback bind chain is exhausted (nothing is permitted to bind), or
// the Playwright browser binary itself is missing (an unfinished environment).
// Those conditions announce a loud skip instead of hanging the suite. Every
// other setup failure — including a browser that EXISTS but fails to launch —
// is a real failure; the assertions themselves are unchanged.
class EnvironmentUnavailable extends Error {}

function isEnvironmentUnavailable (error) {
  if (error instanceof EnvironmentUnavailable) return true
  // Playwright's missing-executable failure names the absent binary path and
  // points at the install command.
  const message = String(error?.message || '')
  return message.includes('Executable doesn\'t exist') || message.includes('playwright install')
}

// Sandboxed runners (restricted containers, the macOS GPU host) permit
// only explicit fixed loopback ports — an ephemeral listen(0) fails with EPERM
// there, and some sandboxes neither error nor call back on a bind. Follow the
// parity harnesses' NM_TS_PORT convention, then fall back through the fleet's
// sandboxed loopback range; every attempt is time-bounded so a wedged bind
// cannot hang the suite.
const FIXED_PORTS = [43117, 43118, 43119, 43120, 43121, 43122, 43123, 43124, 43125, 43126]
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

test('ThreeBackend binds transparent black to an unbound sampler without replacing bound inputs', { timeout: 90000 }, async (t) => {
  const { server, port } = await startServer()
  let browser
  try {
    browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(`http://127.0.0.1:${port}/__frame_export_test__.html`)
    const result = await page.evaluate(async () => {
      const THREE = await import('three')
      const { ThreeBackend } = await import('/src/backend/three-backend.js')
      const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') })
      renderer.setSize(4, 4, false)
      const backend = new ThreeBackend(renderer, { presentToScreen: false })
      const source = new THREE.DataTexture(new Uint8Array([128, 64, 32, 255]), 1, 1)
      const extra = new THREE.DataTexture(new Uint8Array([32, 48, 64, 255]), 1, 1)
      source.needsUpdate = true
      extra.needsUpdate = true
      try {
        await backend.init()
        backend.setExternalTexture('source', source, 1, 1)
        backend.setExternalTexture('extra', extra, 1, 1)
        const output = backend.createTexture('result', { width: 4, height: 4, format: 'rgba8' })
        await backend.compileProgram('fixture', { glsl: `
          precision highp float;
          uniform sampler2D inputTex;
          uniform sampler2D extraTex;
          out vec4 fragColor;
          void main() {
            vec3 a = texelFetch(inputTex, ivec2(0), 0).rgb;
            vec3 b = texelFetch(extraTex, ivec2(0), 0).rgb;
            fragColor = vec4(a * 0.5 + b + vec3(0.25), 1.0);
          }` })
        const samples = []
        for (const inputs of [
          { inputTex: 'source' },
          { inputTex: 'source', extraTex: 'extra' },
          { inputTex: 'source' },
          undefined,
        ]) {
          backend.executePass({ id: 'fixture', program: 'fixture', inputs, outputs: { fragColor: 'result' } }, {})
          const pixels = new Uint8Array(4 * 4 * 4)
          renderer.readRenderTargetPixels(output.target, 0, 0, 4, 4, pixels)
          samples.push(Array.from(pixels))
        }
        const gl = renderer.getContext()
        const debug = gl.getExtension('WEBGL_debug_renderer_info')
        return { samples, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), glError: gl.getError() }
      } finally {
        backend.destroy()
        source.dispose()
        extra.dispose()
        renderer.dispose()
      }
    })
    assert.deepEqual(errors, [])
    assert.equal(result.glError, 0)
    const expected = [[128, 96, 80, 255], [160, 144, 144, 255], [128, 96, 80, 255], [64, 64, 64, 255]]
    for (let sample = 0; sample < expected.length; sample++) {
      for (let pixel = 0; pixel < 16; pixel++) {
        assert.deepEqual(result.samples[sample].slice(pixel * 4, pixel * 4 + 4), expected[sample], `sample ${sample}, pixel ${pixel}`)
      }
    }
    t.diagnostic(JSON.stringify({ renderer: result.renderer, samples: result.samples.map(pixels => pixels.slice(0, 4)), pixelsPerSample: 16, glError: result.glError }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }
})

test('Three frame export reads real WebGL2 pixels asynchronously', async (t) => {
  let server
  let port
  let browser
  try {
    try {
      ({ server, port } = await startServer())
      browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    } catch (error) {
      if (!isEnvironmentUnavailable(error)) throw error
      process.stderr.write(`[SKIP] three frame export browser test: ${error.message}\n`)
      t.skip(error.message)
      return
    }
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${port}/__frame_export_test__.html`)
    const result = await page.evaluate(async () => {
      const { NoisemakerCanvas } = await import('/src/integration/canvas.js')
      document.body.innerHTML = '<canvas width="8" height="8"></canvas>'
      const canvas = new NoisemakerCanvas(document.querySelector('canvas'), {
        width: 8,
        height: 8,
      })
      await canvas.compile(
        'search synth\ngradient(type: linear, rotation: 45).write(o0)\nrender(o0)\n',
      )

      const frames = []
      const errors = []
      const queue = canvas.createFrameExportQueue({
        slots: 2,
        onError (error) { errors.push(error.message) },
      })
      const remove = canvas.addSink({
        configure (descriptor) { queue.configure(descriptor) },
        submit (textureId, timestamp) {
          return queue.enqueue(textureId, timestamp, (frame, deliveredTimestamp) => {
            frames.push({
              width: frame.width,
              height: frame.height,
              rowStride: frame.rowStride,
              data: Array.from(frame.data),
              timestamp: deliveredTimestamp,
            })
          })
        },
        close (options) { queue.close(options) },
      })

      canvas.renderFrame(0, -7.5)
      for (let attempt = 0; attempt < 2000 && frames.length === 0; attempt++) {
        queue.poll()
        await new Promise(resolveFrame => setTimeout(resolveFrame, 0))
      }

      const synchronous = canvas.readPixels()
      const topDown = new Uint8Array(8 * 8 * 4)
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          for (let channel = 0; channel < 4; channel++) {
            const source = ((7 - y) * 8 + x) * 4 + channel
            const destination = (y * 8 + x) * 4 + channel
            topDown[destination] = Math.max(
              0,
              Math.min(255, Math.round(synchronous.data[source] * 255)),
            )
          }
        }
      }

      await canvas.compile(
        'search synth\ngradient(type: linear, rotation: 45).write(o0)\nrender(o0)\n',
      )
      const replacementClosedPreviousSinks = !queue.available
      remove()
      canvas.dispose()

      document.body.innerHTML = '<canvas width="8" height="8"></canvas>'
      const alphaCanvas = new NoisemakerCanvas(document.querySelector('canvas'), {
        width: 8,
        height: 8,
      })
      await alphaCanvas.compile(
        'search synth\nsolid(color: #ff8040, alpha: 0.5).write(o0)\nrender(o0)\n',
      )
      const alphaSamples = []
      let outputDescriptor
      const alphaQueue = alphaCanvas.createFrameExportQueue({ slots: 2 })
      const removeAlpha = alphaCanvas.addSink({
        configure (descriptor) {
          outputDescriptor = descriptor
          alphaQueue.configure(descriptor)
        },
        submit (textureId, timestamp) {
          return alphaQueue.enqueue(textureId, timestamp, (frame) => {
            alphaSamples.push(Array.from(frame.data.slice(0, 4)))
          })
        },
        close (options) { alphaQueue.close(options) },
      })
      for (const alphaMode of ['straight', 'opaque', 'premultiplied']) {
        alphaQueue.configure({ ...outputDescriptor, alphaMode })
        alphaCanvas.renderFrame(0, alphaSamples.length)
        const expectedCount = alphaSamples.length + 1
        for (let attempt = 0;
          attempt < 2000 && alphaSamples.length < expectedCount;
          attempt++) {
          alphaQueue.poll()
          await new Promise(resolveFrame => setTimeout(resolveFrame, 0))
        }
      }
      removeAlpha()
      alphaCanvas.dispose()
      return {
        frame: frames[0],
        errors,
        expected: Array.from(topDown),
        stats: queue.stats,
        alphaSamples,
        replacementClosedPreviousSinks,
      }
    })

    assert.deepEqual(result.errors, [])
    assert.equal(result.frame.timestamp, -7.5)
    assert.deepEqual(
      [result.frame.width, result.frame.height, result.frame.rowStride],
      [8, 8, 32],
    )
    assert.deepEqual(result.frame.data, result.expected)
    assert.deepEqual(result.stats, { accepted: 1, dropped: 0, completed: 1, failed: 0 })
    assert.equal(result.replacementClosedPreviousSinks, true)
    assert.equal(result.alphaSamples.length, 3)
    const [straight, opaque, premultiplied] = result.alphaSamples
    assert.deepEqual(straight.slice(0, 3), opaque.slice(0, 3))
    assert.ok(straight[3] > 0 && straight[3] < 255)
    assert.equal(opaque[3], 255)
    assert.equal(premultiplied[3], straight[3])
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(premultiplied[channel] - Math.round(straight[channel] * straight[3] / 255)) <= 1)
    }
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise(resolveClose => server.close(resolveClose))
  }
})
