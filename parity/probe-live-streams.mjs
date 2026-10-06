#!/usr/bin/env node
// probe-live-streams.mjs — GAP-004 live mic/camera stream acquisition probe.
//
// The graded live-input sweep (sweep-live-inputs.mjs) covers the browser's own
// decoders (fixed PNG/WebM/WAV/OBJ bytes). Live DEVICE streams (getUserMedia
// camera + microphone) cannot be graded for pixel parity: golden and candidate
// each open their own stream, so no two frames are byte-identical. This probe
// therefore grades ACQUISITION on both backends: a real getUserMedia stream is
// bound through the published adapter/engine path, N frames render cleanly
// (no pageerror / console.error), the stream output is live (non-constant) and
// distinct from the same program's no-input fallback rendered over the
// identical time sequence — any pixel difference between the two runs can only
// come from the stream data reaching the shaders.
//
// Chromium fake-device flags provide the deterministic stream provider, so the
// probe runs identically on every platform (headless SwiftShader, native
// Metal, …). This is a manual qualification driver, not part of npm test.
//
// Usage: node parity/probe-live-streams.mjs   (exit 0 iff every case passes)

import { readFileSync, writeFileSync, createReadStream, existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from './launch-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const argv = process.argv.slice(2)
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d }
const hasFlag = (f) => argv.includes(f)
const FRAMES = opt('--frames', 20)
const CAPTURE = opt('--capture', 5)
const SIZE = opt('--size', 128)
const LOOP = opt('--loop', 600)
// --real-devices: bind the machine's ACTUAL camera and microphone instead of
// the fake-device provider (used to measure physical-device acquisition; see
// the run evidence for the environments where this is possible at all).
const REAL_DEVICES = hasFlag('--real-devices')
// A stream-bound frame must differ from the no-input fallback by at least this
// much in a pixel to count as live, and must not be a constant field.
const MIN_MAX_DIFF = 0.02
const MIN_STD = 0.004

// Cases: the camera leg drives media (external texture via updateTextureFromSource);
// the mic leg drives scope and spectrum (audio state via the published AudioState API).
const CASES = [
  { name: 'camera-video-media', kind: 'video', dslPath: 'parity/programs/media.dsl' },
  { name: 'mic-audio-scope', kind: 'audio', dslPath: 'parity/programs/scope.dsl' },
  { name: 'mic-audio-spectrum', kind: 'audio', dslPath: 'parity/programs/spectrum.dsl' },
]

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.dsl': 'text/plain' }
// NM_TS_PORT: sandboxed hosts (the macOS GPU host broker, restricted supervisor
// runners) only permit explicit fixed loopback ports — an ephemeral listen(0)
// fails with EPERM. Honor the env when set, then fall back through the
// sandbox's loopback range.
const FIXED_PORTS = [43117, 43118, 43119, 43120, 43121, 43122, 43123, 43124, 43125, 43126]
// Some sandboxes neither error nor call back on a bind — time-bound every
// attempt so a wedged bind falls through instead of hanging the probe.
const LISTEN_TIMEOUT_MS = 5000
function tryListen(port) {
  return new Promise((resolveBind) => {
    const server = createServer((req, rq) => {
      const p = join(repoRoot, decodeURIComponent(req.url.split('?')[0]))
      if (!p.startsWith(repoRoot) || !existsSync(p) || !statSync(p).isFile()) { rq.statusCode = 404; rq.end('nf'); return }
      rq.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream')
      createReadStream(p).pipe(rq)
    })
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
async function startServer() {
  const candidates = process.env.NM_TS_PORT
    ? [Number(process.env.NM_TS_PORT), 0, ...FIXED_PORTS]
    : [0, ...FIXED_PORTS]
  for (const port of candidates) {
    const { server, bound } = await tryListen(port)
    if (bound) return { server, port: server.address().port }
  }
  throw new Error(`no permitted loopback port (tried ${candidates.join(', ')})`)
}

// Build a LONG fake-mic capture file: the 0.5 s live-audio.wav fixture's PCM
// repeated 60x (same fixed bytes, longer file). Chromium's file-based fake
// capture does not reliably loop across platforms — on macOS the fixture runs
// out and the analyser reads silence, leaving spectrum indistinguishable from
// the no-audio fallback.
function buildFakeMicWav(outPath) {
  const fixture = readFileSync(join(repoRoot, 'parity', 'assets', 'live-audio.wav'))
  const dataLen = fixture.readUInt32LE(40)
  const pcm = fixture.subarray(44, 44 + dataLen)
  const REPEATS = 60
  const out = Buffer.alloc(44 + dataLen * REPEATS)
  fixture.copy(out, 0, 0, 44)
  out.writeUInt32LE(36 + dataLen * REPEATS, 4)
  out.writeUInt32LE(dataLen * REPEATS, 40)
  for (let i = 0; i < REPEATS; i++) pcm.copy(out, 44 + i * dataLen)
  writeFileSync(outPath, out)
  return outPath
}

// Per-pixel max |stream - fallback| and stream-frame mean/std over all channels.
function metrics(streamData, fallbackData) {
  let worst = 0
  let mean = 0
  let meanSq = 0
  const n = streamData.length
  for (let i = 0; i < n; i++) {
    const v = streamData[i]
    mean += v
    meanSq += v * v
    const d = Math.abs(v - fallbackData[i])
    if (d > worst) worst = d
  }
  mean /= n
  meanSq /= n
  return { worst, mean, std: Math.sqrt(Math.max(0, meanSq - mean * mean)) }
}

async function runMode(browser, port, mode, testCase, inject) {
  const msgs = []
  const page = await browser.newPage()
  page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`))
  try {
    await page.goto(`http://127.0.0.1:${port}/parity/page-timeseries.html`, { timeout: 60000 })
    await page.waitForFunction(() => window.__nm_ts_ready === true, { timeout: 30000 })
    const res = await page.evaluate(
      async (a) => { try { return await window.__nm_timeseries(a) } catch (e) { return { error: (e && e.message) || JSON.stringify(e) || String(e), stack: e && e.stack } } },
      {
        dsl: readFileSync(join(repoRoot, testCase.dslPath), 'utf8'),
        mode, size: SIZE, frames: FRAMES, captureEvery: CAPTURE, loopFrames: LOOP, inject,
      }
    )
    if (res?.error || !Array.isArray(res)) throw new Error(res?.error || `${mode}: no captures returned`)
    const errors = msgs.filter((m) => m.startsWith('[pageerror]') || m.startsWith('[error]'))
    if (errors.length) throw new Error(`${mode}: page errors:\n${errors.join('\n')}`)
    const device = inject?.streamLive
      ? await page.evaluate(() => window.__nm_stream_info || null)
      : null
    return { captures: res, device }
  } finally {
    await page.close()
  }
}

function captureStats(stream, fallback, name) {
  const out = []
  let worst = 0
  for (let k = 0; k < stream.length; k++) {
    if (stream[k].frame !== fallback[k]?.frame) throw new Error(`${name}: capture frame mismatch`)
    const m = metrics(stream[k].data, fallback[k].data)
    worst = Math.max(worst, m.worst)
    out.push({ frame: stream[k].frame, maxAbsDiff: Number(m.worst.toFixed(6)), mean: Number(m.mean.toFixed(6)), std: Number(m.std.toFixed(6)) })
  }
  const stdMin = Math.min(...out.map((c) => c.std))
  return { captures: out, worst, stdMin }
}

async function gpuRenderer(browser) {
  const page = await browser.newPage()
  try {
    await page.goto('about:blank')
    return await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      if (!gl) return null
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      }
    })
  } finally {
    await page.close()
  }
}

async function main() {
  const { server, port } = await startServer()
  const outDir = join(repoRoot, 'parity', 'out', 'live-streams')
  mkdirSync(outDir, { recursive: true })
  const args = chromiumLaunchArgs().concat([
    // Deterministic stream provider: the browser's fake camera + fake mic, with
    // permission auto-granted and autoplay unblocked — same provider on every
    // platform, no physical hardware involved. --real-devices drops the fake
    // provider and file capture so the machine's actual camera/mic bind.
    ...(REAL_DEVICES ? [] : ['--use-fake-device-for-media-stream']),
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    ...(!REAL_DEVICES
      ? [
          // Chromium's default fake mic is SILENT (spectrum then stays
          // all-zero and is indistinguishable from the no-audio fallback).
          // Feed the same fixed PCM the graded live-audio sweep decodes,
          // looped into a long file (see buildFakeMicWav — the 0.5 s fixture
          // does not reliably loop), so the analyser sees a real non-silent
          // signal in both modes.
          `--use-file-for-fake-audio-capture=${buildFakeMicWav(join(outDir, 'fake-mic.wav'))}`,
        ]
      : []),
  ])
  const browser = await chromium.launch({ headless: true, args, timeout: 120000 })
  const results = { frames: FRAMES, capture: CAPTURE, size: SIZE, realDevices: REAL_DEVICES, cases: [] }
  let failed = 0
  try {
    results.platform = await gpuRenderer(browser)
    process.stdout.write(`[platform] ${results.platform?.renderer || 'unknown renderer'}\n`)
    for (const mode of ['golden', 'candidate']) {
      for (const testCase of CASES) {
        const label = `${mode}/${testCase.name}`
        try {
          const fallbackRun = await runMode(browser, port, mode, testCase, null)
          const streamRun = await runMode(browser, port, mode, testCase, {
            streamLive: {
              kind: testCase.kind,
              // Real devices may legitimately be silent (a quiet room) — wait
              // briefly and record what was actually seen.
              signalTimeoutMs: REAL_DEVICES ? 2000 : undefined,
              silentOk: REAL_DEVICES,
            },
          })
          const { captures, worst, stdMin } = captureStats(streamRun.captures, fallbackRun.captures, label)
          const ok = worst >= MIN_MAX_DIFF && stdMin >= MIN_STD
          const why = !ok
            ? (worst < MIN_MAX_DIFF ? `stream output indistinct from fallback (worst max-abs-diff ${worst})`
                                    : `stream output constant (min std ${stdMin})`)
            : null
          if (!ok) failed++
          results.cases.push({ label, pass: ok, reason: why, device: streamRun.device, worstMaxAbsDiff: Number(worst.toFixed(6)), minStd: Number(stdMin.toFixed(6)), captures })
          process.stdout.write(`[${ok ? 'pass' : 'FAIL'}] ${label}: worst max-abs-diff ${worst.toFixed(4)}, min std ${stdMin.toFixed(4)}${streamRun.device?.label ? `, device "${streamRun.device.label}"` : ''}${why ? ' — ' + why : ''}\n`)
        } catch (error) {
          failed++
          results.cases.push({ label, pass: false, reason: String(error?.message || error) })
          process.stderr.write(`[FAIL] ${label}: ERROR ${error?.stack || error}\n`)
        }
      }
    }
  } finally {
    writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2))
    await browser.close().catch(() => browser.process()?.kill('SIGKILL'))
    server.close()
  }
  const pass = results.cases.filter((c) => c.pass).length
  process.stdout.write(`PROBE-LIVE-STREAMS {"cases":${results.cases.length},"pass":${pass},"fail":${failed}}\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => { process.stderr.write(`[probe-live-streams] FAILED: ${e?.stack || e}\n`); process.exit(1) })
