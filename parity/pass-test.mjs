#!/usr/bin/env node
// pass-test.mjs — functional test for NoisemakerPass (EffectComposer integration).
//
// Two checks, run in-page (parity/page.html → window.__nm_render_pass):
//   1. Generative parity: a self-contained program through an EffectComposer
//      NoisemakerPass must equal NoisemakerCanvas of the same program, bit-exact
//      (max-abs-diff = 0). Proves the pass's render + blit-to-writeBuffer plumbing.
//   2. Filter binding: a known solid-color scene fed through `media().write(o0)`
//      must come back as that color. Proves the scene→external-source binding.
//
// Usage: node pass-test.mjs [program.dsl] [--size 256] [--time 0.25] [--frames 8]

import { readFileSync, createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const argv = process.argv.slice(2)
const getOpt = (flag, def) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? Number(argv[i + 1]) : def
}
const dslPath = argv[0] && !argv[0].startsWith('--') ? argv[0] : null
const size = getOpt('--size', 256)
const time = getOpt('--time', 0.25)
const frames = getOpt('--frames', 8)
// Default generative program: animated + multi-pass (bloom) to exercise plumbing.
const dsl = dslPath
  ? readFileSync(dslPath, 'utf8')
  : 'search synth, filter\nnoise(scaleX: 40, scaleY: 40, seed: 2).bloom().write(o0)\nrender(o0)'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glsl': 'text/plain' }
function startServer() {
  return new Promise((res) => {
    const server = createServer((req, rsp) => {
      const p = join(repoRoot, decodeURIComponent(req.url.split('?')[0]))
      if (!p.startsWith(repoRoot) || !existsSync(p) || !statSync(p).isFile()) {
        rsp.statusCode = 404
        return rsp.end('not found')
      }
      rsp.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream')
      createReadStream(p).pipe(rsp)
    })
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }))
  })
}

async function main() {
  const { server, port } = await startServer()
  const launchArgs = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') launchArgs.push('--use-angle=metal')
  const browser = await chromium.launch({ headless: true, args: launchArgs })
  try {
    const page = await browser.newPage()
    const messages = []
    page.on('console', (m) => messages.push(`[${m.type()}] ${m.text()}`))
    page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`))
    await page.goto(`http://127.0.0.1:${port}/parity/page.html`)
    try {
      await page.waitForFunction(() => window.__nm_ready === true, { timeout: 30000 })
    } catch (e) {
      process.stderr.write(`[pass] page not ready:\n${messages.join('\n')}\n`)
      throw e
    }
    const r = await page.evaluate(
      async (a) => {
        try {
          return await window.__nm_render_pass(a.dsl, a.size, a.time, a.frames)
        } catch (e) {
          return { error: e?.message || String(e), stack: e?.stack }
        }
      },
      { dsl, size, time, frames }
    )
    if (r?.error) {
      process.stderr.write(`[pass] error: ${r.error}\n${r.stack || ''}\n`)
      if (messages.length) process.stderr.write(messages.join('\n') + '\n')
      process.exit(1)
    }
    const genOK = r.maxDiff <= 0.001
    const fmt = (a) => `[${a.map((v) => v.toFixed(3)).join(', ')}]`
    process.stdout.write(
      `[pass] generative parity (vs NoisemakerCanvas): max-abs-diff=${r.maxDiff.toFixed(3)} sourceIds=${JSON.stringify(r.sourceIds)} -> ${genOK ? 'PASS' : 'FAIL'}\n`
    )
    process.stdout.write(
      `[pass] filter binding (media reads scene): scene=${fmt(r.scene)} center=${fmt(r.center)} ids=${JSON.stringify(r.filterSourceIds)} -> ${r.boundOK ? 'PASS' : 'FAIL'}\n`
    )
    process.exit(genOK && r.boundOK ? 0 : 1)
  } finally {
    await browser.close()
    server.close()
  }
}
main()
