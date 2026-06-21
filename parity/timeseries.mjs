#!/usr/bin/env node
// timeseries.mjs — deterministic stateful parity over a time series.
//
// Renders a program for N frames advancing normalized time t_i = (i % loopFrames)/loopFrames
// (deltaTime is derived from t deltas — fully deterministic), capturing every `capture`
// frames. Runs BOTH the GOLDEN (vendored reference WebGL2 backend) and the CANDIDATE
// (ThreeBackend) in the same harness with the identical time sequence, then compares each
// captured frame. For chaotic/continuous sims (navierStokes, flow, …) per the 30s/5s tip.
//
// Usage: node timeseries.mjs <program.dsl> [--frames 1800] [--capture 300] [--size 256]
//        [--loop 600] [--py <python>]

import { readFileSync, writeFileSync, createReadStream, existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const argv = process.argv.slice(2)
const dslPath = argv[0]
if (!dslPath) { process.stderr.write('usage: node timeseries.mjs <program.dsl> [--frames N] [--capture K] [--size S] [--loop L]\n'); process.exit(2) }
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d }
const frames = opt('--frames', 1800)
const capture = opt('--capture', 300)
const size = opt('--size', 256)
const loopFrames = opt('--loop', 600) // 10s loop @ 60fps
const pyIdx = argv.indexOf('--py')
const PY = pyIdx >= 0 ? argv[pyIdx + 1] : join(repoRoot, 'parity', '.venv', 'bin', 'python')
const name = basename(dslPath).replace(/\.dsl$/, '')
const dsl = readFileSync(dslPath, 'utf8')

// Optional DETERMINISTIC external-input spec for long-tail effects (scope/spectrum/
// media/mesh). Either `--inject <file.json>` or an auto-detected `<name>.inject.json`
// sidecar next to the .dsl. Applied identically to golden + candidate (see page harness).
const injectIdx = argv.indexOf('--inject')
const injectSidecar = dslPath.replace(/\.dsl$/, '.inject.json')
let inject = null
if (injectIdx >= 0) inject = JSON.parse(readFileSync(argv[injectIdx + 1], 'utf8'))
else if (existsSync(injectSidecar)) inject = JSON.parse(readFileSync(injectSidecar, 'utf8'))
const outDir = join(repoRoot, 'parity', 'out', `ts_${name}`)
mkdirSync(outDir, { recursive: true })

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glsl': 'text/plain', '.vert': 'text/plain', '.frag': 'text/plain', '.wgsl': 'text/plain' }
function startServer() {
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

function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1}return(c^0xffffffff)>>>0}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const b=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(b),0);return Buffer.concat([l,b,c])}
function encodePng(w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}

function toPng(flat, size) {
  const rgba8 = new Uint8Array(size * size * 4)
  for (let i = 0; i < flat.length; i++) rgba8[i] = Math.max(0, Math.min(255, Math.round(flat[i] * 255)))
  const top = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = ((size - 1 - y) * size + x) * 4, d = (y * size + x) * 4
    top[d] = rgba8[s]; top[d + 1] = rgba8[s + 1]; top[d + 2] = rgba8[s + 2]; top[d + 3] = rgba8[s + 3]
  }
  return encodePng(size, size, top)
}

async function runMode(browser, port, mode) {
  const page = await browser.newPage()
  const msgs = []
  page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`))
  await page.goto(`http://127.0.0.1:${port}/parity/page-timeseries.html`)
  await page.waitForFunction(() => window.__nm_ts_ready === true, { timeout: 30000 })
  const res = await page.evaluate(
    async (a) => { try { return await window.__nm_timeseries(a) } catch (e) { return { error: e?.message, stack: e?.stack } } },
    { dsl, mode, size, frames, captureEvery: capture, loopFrames, inject }
  )
  await page.close()
  if (res?.error) { process.stderr.write(`[${mode}] ERROR: ${res.error}\n${res.stack||''}\n${msgs.slice(-5).join('\n')}\n`); throw new Error(res.error) }
  return res
}

async function main() {
  const { server, port } = await startServer()
  const launchArgs = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') launchArgs.push('--use-angle=metal')
  const browser = await chromium.launch({ headless: true, args: launchArgs })
  try {
    process.stderr.write(`[ts] ${name}: ${frames} frames, capture every ${capture}, size ${size}, loop ${loopFrames}\n`)
    const golden = await runMode(browser, port, 'golden')
    process.stderr.write(`[ts] golden: ${golden.length} captures\n`)
    const candidate = await runMode(browser, port, 'candidate')
    process.stderr.write(`[ts] candidate: ${candidate.length} captures\n`)

    let worst = 0
    for (let k = 0; k < golden.length; k++) {
      const fr = golden[k].frame
      const gPng = join(outDir, `f${fr}.golden.png`)
      const cPng = join(outDir, `f${fr}.candidate.png`)
      writeFileSync(gPng, toPng(golden[k].data, size))
      writeFileSync(cPng, toPng(candidate[k].data, size))
      const r = spawnSync(PY, [join(repoRoot, 'parity', 'compare.py'), gPng, cPng, '--name', `${name}@f${fr}`, '--tolerance', '2.001', '--ssim-min', '0.98'], { encoding: 'utf8' })
      const line = (r.stdout || r.stderr || '').trim().split('\n').pop()
      process.stdout.write(line + '\n')
      const m = /max-abs-diff=([0-9.]+)/.exec(line)
      if (m) worst = Math.max(worst, Number(m[1]))
    }
    process.stdout.write(`[ts] ${name}: worst max-abs-diff across ${golden.length} samples = ${worst}\n`)
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch((e) => { process.stderr.write(`[ts] FAILED: ${e?.stack || e}\n`); process.exit(1) })
