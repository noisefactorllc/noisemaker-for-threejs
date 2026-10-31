import { test } from 'node:test'
import assert from 'node:assert'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from '../parity/launch-args.mjs'

// NoisemakerCanvas context-loss recovery, ported from the upstream CanvasRenderer
// contract: after a lost WebGL context the renderer presents on a fresh canvas in
// the old canvas's place, whether the browser restores the context or not; compile()
// on an unrestored context moves to a fresh canvas; a context lost while the
// program drew its first frames is not rebuilt automatically.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
}

function requestHandler (request, response) {
  const requestPath = decodeURIComponent(request.url.split('?')[0])
  if (requestPath === '/__context_loss_test__.html') {
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

class EnvironmentUnavailable extends Error {}

function isEnvironmentUnavailable (error) {
  if (error instanceof EnvironmentUnavailable) return true
  const message = String(error?.message || '')
  return message.includes('Executable doesn\'t exist') || message.includes('playwright install')
}

const FIXED_PORTS = [43127, 43128, 43129, 43130, 43131, 43132, 43133, 43134, 43135, 43136]
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

async function runCase (page, name) {
  return page.evaluate(async (caseName) => {
    const { NoisemakerCanvas } = await import('/src/integration/canvas.js')
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const DSL = 'search synth\nnoise().write(o0)'

    async function setup (frames) {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const events = []
      const nc = new NoisemakerCanvas(canvas, {
        onContextLost: () => events.push('lost'),
        onContextRestored: () => events.push('restored'),
      })
      // Let the software rasterizer's transient construction-time loss pass
      // before the first compile, so the pipeline is built on a stable context.
      await sleep(2200)
      events.length = 0 // discard the construction-time transient's events
      await nc.compile(DSL)
      for (let i = 0; i < frames; i++) nc.renderFrame(0.5)
      const lose = nc.canvas.getContext('webgl2').getExtension('WEBGL_lose_context')
      return { nc, events, lose, original: nc.canvas }
    }

    async function waitEvent (events, name, timeoutMs) {
      const deadline = performance.now() + timeoutMs
      while (!events.includes(name)) {
        if (performance.now() >= deadline) throw new Error('timed out waiting for ' + name + '; saw ' + events.join(','))
        await sleep(50)
      }
    }

    function sanity (nc) {
      const px = nc.pipeline.backend.readPixels()
      return { w: px.width, h: px.height, len: px.data.length, nonzero: px.data.some((v) => v !== 0) }
    }

    if (caseName === 'restore') {
      const { nc, events, lose, original } = await setup(2)
      lose.loseContext()
      await waitEvent(events, 'lost', 10000)
      lose.restoreContext()
      await waitEvent(events, 'restored', 10000)
      nc.renderFrame(0.5)
      return { changed: nc.canvas !== original, events, pixels: sanity(nc) }
    }
    if (caseName === 'no-restore-compile') {
      const { nc, events, lose, original } = await setup(2)
      lose.loseContext()
      await waitEvent(events, 'lost', 10000)
      await nc.compile(DSL)
      nc.renderFrame(0.5)
      return { changed: nc.canvas !== original, events, pixels: sanity(nc) }
    }
    if (caseName === 'recovery-timer') {
      const { nc, events, lose, original } = await setup(2)
      lose.loseContext()
      await waitEvent(events, 'lost', 10000)
      await waitEvent(events, 'restored', 8000)
      nc.renderFrame(0.5)
      return { changed: nc.canvas !== original, events, pixels: sanity(nc) }
    }
    if (caseName === 'pre-compile-loss') {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const events = []
      const nc = new NoisemakerCanvas(canvas, {
        onContextLost: () => events.push('lost'),
        onContextRestored: () => events.push('restored'),
      })
      // Let the software rasterizer's transient construction-time loss pass and
      // discard its events, so the loss below is deterministic.
      await sleep(2200)
      events.length = 0
      nc.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()
      await waitEvent(events, 'lost', 10000)
      await nc.compile(DSL)
      nc.renderFrame(0.5)
      return { changed: nc.canvas !== canvas, events, pixels: sanity(nc) }
    }
    if (caseName === 'failed-render') {
      const { nc, original } = await setup(0)
      const broken = nc.pipeline.render.bind(nc.pipeline)
      nc.pipeline.render = () => { throw new Error('draw failed') }
      let threw = false
      try { nc.renderFrame(0.5) } catch { threw = true }
      const countAfterFailure = nc._frameCount
      nc.pipeline.render = broken
      nc.renderFrame(0.5)
      return { threw, countAfterFailure, countAfterSuccess: nc._frameCount, changed: nc.canvas === original }
    }
    if (caseName === 'first-frame-skip') {
      const { nc, events, lose, original } = await setup(1)
      lose.loseContext()
      await waitEvent(events, 'lost', 10000)
      lose.restoreContext()
      await waitEvent(events, 'restored', 10000)
      const skipped = nc.pipeline === null
      await nc.compile(DSL)
      nc.renderFrame(0.5)
      return { changed: nc.canvas !== original, events, skipped, pixels: sanity(nc) }
    }
    throw new Error('unknown case ' + caseName)
  }, name)
}

test('NoisemakerCanvas recovers on a fresh canvas after a lost WebGL context', { timeout: 180000 }, async (t) => {
  let server
  let port
  let browser
  try {
    try {
      ({ server, port } = await startServer())
      browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    } catch (error) {
      if (!isEnvironmentUnavailable(error)) throw error
      process.stderr.write(`[SKIP] context-loss browser test: ${error.message}\n`)
      t.skip(error.message)
      return
    }
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(`http://127.0.0.1:${port}/__context_loss_test__.html`)

    const restore = await runCase(page, 'restore')
    assert.ok(restore.changed, 'restore: the renderer presents on a fresh canvas')
    assert.equal(restore.events[0], 'lost')
    assert.equal(restore.events[1], 'restored')
    assert.equal(restore.pixels.w, 128)
    assert.equal(restore.pixels.len, 128 * 128 * 4)
    assert.ok(restore.pixels.nonzero, 'restore: the rebuilt pipeline renders')

    const noRestore = await runCase(page, 'no-restore-compile')
    assert.ok(noRestore.changed, 'compile on a lost context: the renderer moves to a fresh canvas')
    assert.ok(noRestore.events.includes('restored'), 'compile on a lost context: the host learns rendering is back')
    assert.ok(noRestore.pixels.nonzero, 'compile on a lost context: the rebuilt pipeline renders')

    const timer = await runCase(page, 'recovery-timer')
    assert.ok(timer.changed, 'an unrestored context: the recovery timer moves to a fresh canvas')
    assert.ok(timer.pixels.nonzero, 'an unrestored context: the rebuilt pipeline renders')

    const preCompile = await runCase(page, 'pre-compile-loss')
    assert.equal(preCompile.events[0], 'lost', 'pre-compile loss: the loss is marked before the first compile')
    assert.ok(preCompile.events.includes('restored'), 'pre-compile loss: the host learns rendering is back')
    assert.ok(preCompile.changed, 'pre-compile loss: compile() moves to a fresh canvas')
    assert.ok(preCompile.pixels.nonzero, 'pre-compile loss: the built pipeline renders')

    const failed = await runCase(page, 'failed-render')
    assert.ok(failed.threw, 'failed render: the draw error surfaces')
    assert.equal(failed.countAfterFailure, 0, 'failed render: the frame is not counted')
    assert.equal(failed.countAfterSuccess, 1, 'failed render: a later successful draw is counted')

    const firstFrame = await runCase(page, 'first-frame-skip')
    assert.ok(firstFrame.changed, 'first-frame loss: the canvas is still replaced')
    assert.ok(firstFrame.skipped, 'first-frame loss: the program is not rebuilt automatically')
    assert.ok(firstFrame.pixels.nonzero, 'first-frame loss: the next compile() builds')

    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise((resolveClose) => server?.close(resolveClose))
  }
})
