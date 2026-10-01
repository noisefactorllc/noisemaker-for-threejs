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
//        node timeseries.mjs --batch-manifest <json> [--py <python>]

import { readFileSync, writeFileSync, createReadStream, existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from './launch-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const argv = process.argv.slice(2)
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d }
const pyIdx = argv.indexOf('--py')
const PY = pyIdx >= 0 ? argv[pyIdx + 1] : (process.env.NM_PARITY_PYTHON || join(repoRoot, 'parity', '.venv', 'bin', 'python'))
const batchIdx = argv.indexOf('--batch-manifest')

function loadCase(raw) {
  const dslPath = resolve(raw.dslPath)
  const injectSidecar = dslPath.replace(/\.dsl$/, '.inject.json')
  let inject = raw.inject || null
  if (!inject && raw.injectPath) inject = JSON.parse(readFileSync(raw.injectPath, 'utf8'))
  else if (!inject && existsSync(injectSidecar)) inject = JSON.parse(readFileSync(injectSidecar, 'utf8'))
  return {
    dslPath,
    name: basename(dslPath).replace(/\.dsl$/, ''),
    dsl: readFileSync(dslPath, 'utf8'),
    frames: Number(raw.frames ?? 1800),
    capture: Number(raw.capture ?? 300),
    size: Number(raw.size ?? 256),
    loopFrames: Number(raw.loopFrames ?? 600),
    inject
  }
}

let cases
if (batchIdx >= 0) {
  const manifest = JSON.parse(readFileSync(argv[batchIdx + 1], 'utf8'))
  cases = manifest.cases.map(loadCase)
} else {
  const dslPath = argv[0]
  if (!dslPath) { process.stderr.write('usage: node timeseries.mjs <program.dsl> [--frames N] [--capture K] [--size S] [--loop L]\n'); process.exit(2) }
  const injectIdx = argv.indexOf('--inject')
  cases = [loadCase({
    dslPath,
    frames: opt('--frames', 1800),
    capture: opt('--capture', 300),
    size: opt('--size', 256),
    loopFrames: opt('--loop', 600),
    injectPath: injectIdx >= 0 ? argv[injectIdx + 1] : null
  })]
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glsl': 'text/plain', '.vert': 'text/plain', '.frag': 'text/plain', '.wgsl': 'text/plain', '.png': 'image/png', '.wav': 'audio/wav', '.webm': 'video/webm' }
function startServer() {
  return new Promise((res) => {
    const server = createServer((req, rq) => {
      const p = join(repoRoot, decodeURIComponent(req.url.split('?')[0]))
      if (!p.startsWith(repoRoot) || !existsSync(p) || !statSync(p).isFile()) { rq.statusCode = 404; rq.end('nf'); return }
      rq.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream')
      createReadStream(p).pipe(rq)
    })
    // NM_TS_PORT: some sandboxed hosts (e.g. the macOS GPU host broker) only
    // permit an explicit loopback port from a fixed range — listen(0) is EPERM.
    const fixedPort = process.env.NM_TS_PORT ? Number(process.env.NM_TS_PORT) : 0
    server.listen(fixedPort, '127.0.0.1', () => res({ server, port: server.address().port }))
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

async function runMode(browser, port, mode, testCase) {
  const { dsl, size, frames, capture, loopFrames, inject } = testCase
  // newPage is the last unbounded browser call: a wedged browser (poisoned
  // Windows SwiftShader GPU process, shard 47of48 runner losses) can hang it
  // forever — beyond the evaluate watchdog, the launch/goto timeouts, and the
  // chunk spawn backstop, so the job hung until the runner died. Race it with
  // 60 s; on timeout the caller restarts the browser and marks the case ERR.
  // Race newPage with a 60 s bound; the timer is cleared on settlement so it
  // never holds the chunk child alive past its last page creation.
  const msgs = []
  let newPageTimer
  const page = await Promise.race([
    browser.newPage(),
    new Promise((resolve, reject) => {
      newPageTimer = setTimeout(() => reject(new Error(`${mode}: browser.newPage timed out after 60000ms`)), 60000)
    }),
  ])
  clearTimeout(newPageTimer)
  page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`))
  await page.goto(`http://127.0.0.1:${port}/parity/page-timeseries.html`, { timeout: 60000 })
  await page.waitForFunction(() => window.__nm_ts_ready === true, { timeout: 30000 })
  // Per-mode watchdog: a case that never finishes must not hang the whole
  // batched run (an earlier windows CI leg lost its runner after ~55 minutes
  // with no timeout in place). The timeout marks the case ERR, not a pass.
  // octaveWarp legitimately renders ~75 s per mode locally and slower on CI
  // (its golden took > 600 s per mode on windows SwiftShader, run
  // 36570469321), so the default is generous.
  const evalTimeoutMs = Number(process.env.NM_TS_TIMEOUT_MS || 1200000)
  const timeoutMsgs = () => msgs.slice(-8).join('\n')
  let timer
  let res
  try {
    res = await Promise.race([
      page.evaluate(
        async (a) => { try { return await window.__nm_timeseries(a) } catch (e) { return { error: (e && e.message) || JSON.stringify(e) || String(e), stack: e && e.stack } } },
        { dsl, mode, size, frames, captureEvery: capture, loopFrames, inject }
      ),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${mode}: timed out after ${evalTimeoutMs}ms\n${timeoutMsgs()}`)), evalTimeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
    await page.close()
  }
  if (res?.error || !Array.isArray(res)) {
    const why = res?.error || `${mode}: no captures returned`
    process.stderr.write(`[${mode}] ERROR: ${why}\n${res?.stack || ''}\n${msgs.slice(-8).join('\n')}\n`)
    throw new Error(why)
  }
  return res
}

async function runCase(browser, port, testCase) {
    const { name, frames, capture, size, loopFrames } = testCase
    const outDir = join(repoRoot, 'parity', 'out', `ts_${name}`)
    mkdirSync(outDir, { recursive: true })
    process.stderr.write(`[ts] ${name}: ${frames} frames, capture every ${capture}, size ${size}, loop ${loopFrames}\n`)
    const golden = await runMode(browser, port, 'golden', testCase)
    process.stderr.write(`[ts] ${name} golden: ${golden.length} captures\n`)
    const candidate = await runMode(browser, port, 'candidate', testCase)
    process.stderr.write(`[ts] ${name} candidate: ${candidate.length} captures\n`)

    let worst = 0
    let failed = false
    for (let k = 0; k < golden.length; k++) {
      const fr = golden[k].frame
      const gPng = join(outDir, `f${fr}.golden.png`)
      const cPng = join(outDir, `f${fr}.candidate.png`)
      writeFileSync(gPng, toPng(golden[k].data, size))
      writeFileSync(cPng, toPng(candidate[k].data, size))
      const r = spawnSync(PY, [join(repoRoot, 'parity', 'compare.py'), gPng, cPng, `--name=${name}@f${fr}`, '--tolerance', '0', '--ssim-min', '1'], { encoding: 'utf8' })
      const line = (r.stdout || r.stderr || '').trim().split('\n').pop()
      process.stdout.write(line + '\n')
      if (r.status !== 0) failed = true
      const m = /max-abs-diff=([0-9.]+)/.exec(line)
      if (m) worst = Math.max(worst, Number(m[1]))
    }
    process.stdout.write(`[ts] ${name}: worst max-abs-diff across ${golden.length} samples = ${worst}\n`)
    return !failed
}

// Bounded browser teardown: after a wedged case (e.g. a poisoned Windows
// SwiftShader GPU process), browser.close() itself can hang forever — that
// hung the whole chunked run until the runner died (runs 36536453382,
// 36542869365, shard 47of48). Race close() with 30 s, then SIGKILL the
// browser process so the next case starts clean.
async function closeBrowser(browser) {
  try {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 30000)),
    ])
  } catch {
    // fall through to the SIGKILL below
  }
  try {
    browser.process()?.kill('SIGKILL')
  } catch {
    // already gone
  }
}

async function main() {
  const { server, port } = await startServer()
  const launchArgs = chromiumLaunchArgs()
  // launch timeout: a hung chromium launch must fail fast (it previously hung
  // a windows gate until the runner died at ~55-68 min; run 36536453382,
  // shard 47of48, died with 7 cases) instead of hanging past the spawnSync
  // backstop and the hosted VM's observed ~55-minute survival ceiling.
  // A long-lived chromium also accumulates memory across hundreds of page
  // loads (SIGKILL/hang, runs 36477534981+), so it restarts every 25 cases.
  const BROWSER_RESTART_EVERY = 25
  let browser = await chromium.launch({ headless: true, args: launchArgs, timeout: 120000 })
  try {
    let failed = 0
    for (const [index, testCase] of cases.entries()) {
      // Restart the browser on the periodic schedule AND after any failed case:
      // a wedged case can poison the shared browser/GPU process, and the next
      // case must not inherit it.
      if (index > 0 && index % BROWSER_RESTART_EVERY === 0) {
        await closeBrowser(browser)
        browser = await chromium.launch({ headless: true, args: launchArgs, timeout: 120000 })
      }
      let ok = false
      try {
        ok = await runCase(browser, port, testCase)
      } catch (error) {
        process.stderr.write(`[ts] ${testCase.name}: ERROR ${error?.stack || error}\n`)
      }
      if (!ok) {
        failed++
        await closeBrowser(browser)
        browser = await chromium.launch({ headless: true, args: launchArgs, timeout: 120000 })
      }
    }
    if (failed > 0) process.exitCode = 1
  } finally {
    await closeBrowser(browser)
    server.close()
  }
}
main().catch((e) => { process.stderr.write(`[ts] FAILED: ${e?.stack || e}\n`); process.exit(1) })
