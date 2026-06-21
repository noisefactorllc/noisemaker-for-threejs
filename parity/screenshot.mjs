#!/usr/bin/env node
// screenshot.mjs — render a DSL program via NoisemakerCanvas (three.js + ThreeBackend on the
// CDN engine), step it `frames` frames so the stateful sim evolves, and screenshot the page
// (DSL + canvas) to parity/out/<name>.png.
//
// Usage: node parity/screenshot.mjs <program.dsl> [--frames 1800] [--loop 600] [--size 512]
import { readFileSync, existsSync, statSync, mkdirSync, createReadStream } from 'node:fs'
import { dirname, resolve, join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const argv = process.argv.slice(2)
const dslPath = argv[0] || join(repoRoot, 'parity', 'programs', 'preview-target.dsl')
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d }
const frames = opt('--frames', 1800) // 30s @ 60fps
const loop = opt('--loop', 600)      // 10s loop
const size = opt('--size', 512)
const name = basename(dslPath).replace(/\.dsl$/, '')
const dsl = readFileSync(dslPath, 'utf8')
const outDir = join(repoRoot, 'parity', 'out')
mkdirSync(outDir, { recursive: true })
const outPng = join(outDir, `${name}.png`)

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glsl': 'text/plain', '.vert': 'text/plain', '.frag': 'text/plain', '.css': 'text/css' }
function startServer () {
  return new Promise((res) => {
    const server = createServer((req, rq) => {
      const p = join(repoRoot, decodeURIComponent(req.url.split('?')[0]))
      if (!p.startsWith(repoRoot) || !existsSync(p) || !statSync(p).isFile()) { rq.statusCode = 404; rq.end('nf'); return }
      rq.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream')
      createReadStream(p).pipe(rq)
    })
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }))
  })
}

async function main () {
  if (!existsSync(join(repoRoot, 'vendor', 'noisemaker', 'noisemaker-shaders-core.esm.js'))) {
    throw new Error('engine not fetched — run: bash vendor/fetch.sh')
  }
  const { server, port } = await startServer()
  const args = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') args.push('--use-angle=metal')
  const browser = await chromium.launch({ headless: true, args })
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 2 })
    page.on('console', (m) => process.stderr.write(`[page:${m.type()}] ${m.text()}\n`))
    page.on('pageerror', (e) => process.stderr.write(`[pageerror] ${e.message}\n`))
    await page.goto(`http://127.0.0.1:${port}/parity/preview.html`)
    await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
    process.stderr.write(`[shot] rendering ${name}: ${frames} frames @ ${size}px (loop ${loop})…\n`)
    const r = await page.evaluate(
      async (a) => { try { await window.__run(a); return { ok: true } } catch (e) { return { ok: false, error: (e && e.message) || JSON.stringify(e) || String(e) } } },
      { dsl, frames, loop, size }
    )
    if (!r.ok) throw new Error(`render failed: ${r.error}`)
    await page.waitForFunction(() => window.__done === true, { timeout: 360000 })
    await page.screenshot({ path: outPng, fullPage: true })
    process.stderr.write(`[shot] wrote ${outPng}\n`)
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch((e) => { process.stderr.write(`[shot] FAILED: ${e?.stack || e}\n`); process.exit(1) })
