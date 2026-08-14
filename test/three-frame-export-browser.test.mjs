import { test } from 'node:test'
import assert from 'node:assert'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
}

function startServer () {
  return new Promise((resolveServer) => {
    const server = createServer((request, response) => {
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
    })
    server.listen(0, '127.0.0.1', () => {
      resolveServer({ server, port: server.address().port })
    })
  })
}

test('Three frame export reads real WebGL2 pixels asynchronously', async () => {
  const { server, port } = await startServer()
  const args = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') args.push('--use-angle=metal')
  const browser = await chromium.launch({ headless: true, args })
  try {
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
    await browser.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }
})
