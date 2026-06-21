#!/usr/bin/env node
// render-candidate.mjs — CANDIDATE renderer for a parity program.
//
// Renders a DSL program through noisemaker-three (three.js + ThreeBackend) in
// headless Chromium and writes <outDir>/<name>.candidate.png. The candidate runs
// the SAME reused compiler as the golden, so this validates the BACKEND's fidelity.
//
// Capture matches export-golden.mjs exactly: 256x256, time 0.25, 8 settle frames,
// read the render surface as LINEAR FLOAT, quantize round(v*255), flip to top-down.
//
// Usage: node render-candidate.mjs <program.dsl> <outDir> [--size 256] [--time 0.25] [--frames 8]

import { readFileSync, writeFileSync, createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, resolve, basename, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// ---- args ----
const argv = process.argv.slice(2)
if (argv.length < 2) {
  process.stderr.write('usage: node render-candidate.mjs <program.dsl> <outDir> [--size N] [--time T] [--frames N]\n')
  process.exit(2)
}
const dslPath = argv[0]
const outDir = argv[1]
const getOpt = (flag, def) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? Number(argv[i + 1]) : def
}
const size = getOpt('--size', 256)
const time = getOpt('--time', 0.25)
const frames = getOpt('--frames', 8)
const programName = basename(dslPath).replace(/\.dsl$/, '')
const dsl = readFileSync(dslPath, 'utf8')

// ---- minimal static server (serves the repo so the page can import/fetch) ----
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.glsl': 'text/plain',
  '.vert': 'text/plain',
  '.frag': 'text/plain',
  '.wgsl': 'text/plain',
}
function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      const filePath = join(repoRoot, urlPath)
      if (!filePath.startsWith(repoRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.statusCode = 404
        res.end('not found')
        return
      }
      res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream')
      createReadStream(filePath).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => resolveServer({ server, port: server.address().port }))
  })
}

// ---- PNG encode (identical to export-golden.mjs) ----
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgbaTopDown) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgbaTopDown.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

async function main() {
  const { server, port } = await startServer()
  // Match the golden harness GL backend exactly (shade-mcp getBrowserLaunchOptions):
  // ANGLE/Metal on darwin, NOT SwiftShader — float rasterization must be identical.
  const launchArgs = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') launchArgs.push('--use-angle=metal')
  const browser = await chromium.launch({ headless: true, args: launchArgs })
  try {
    const page = await browser.newPage()
    const messages = []
    page.on('console', (m) => messages.push(`[${m.type()}] ${m.text()}`))
    page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`))
    await page.goto(`http://127.0.0.1:${port}/parity/page.html`)
    await page.waitForFunction(() => window.__nm_ready === true, { timeout: 30000 })

    const result = await page.evaluate(
      async ({ dsl, size, time, frames }) => {
        try {
          return await window.__nm_render(dsl, size, time, frames)
        } catch (e) {
          return { error: e?.message || String(e), stack: e?.stack }
        }
      },
      { dsl, size, time, frames }
    )

    if (result?.error) {
      process.stderr.write(`[candidate] render error: ${result.error}\n${result.stack || ''}\n`)
      if (messages.length) process.stderr.write(messages.join('\n') + '\n')
      process.exit(1)
    }

    const { width, height, data } = result
    // Quantize linear float -> 8-bit (no sRGB), then flip bottom-up -> top-down.
    const rgba8 = new Uint8Array(width * height * 4)
    for (let i = 0; i < data.length; i++) {
      rgba8[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)))
    }
    const topDown = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = ((height - 1 - y) * width + x) * 4
        const dst = (y * width + x) * 4
        topDown[dst] = rgba8[src]
        topDown[dst + 1] = rgba8[src + 1]
        topDown[dst + 2] = rgba8[src + 2]
        topDown[dst + 3] = rgba8[src + 3]
      }
    }
    const png = encodePng(width, height, topDown)
    const outPath = join(outDir, `${programName}.candidate.png`)
    writeFileSync(outPath, png)
    process.stderr.write(`[candidate] wrote ${outPath} (${width}x${height}, time=${time}, frames=${frames})\n`)
    if (messages.length) process.stderr.write('[candidate] console:\n  ' + messages.join('\n  ') + '\n')
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  process.stderr.write(`[candidate] FAILED: ${err?.stack || err?.message || err}\n`)
  process.exit(1)
})
