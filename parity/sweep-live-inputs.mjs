#!/usr/bin/env node
// sweep-live-inputs.mjs — GAP-004 live external-input parity sweep.
//
// Runs parity/timeseries.mjs over parity/live-inputs.manifest.json: the media /
// scope / spectrum programs with the external data produced by the browser's own
// decoders (fixed PNG image, fixed WebM <video> decode, fixed WAV audio decode)
// instead of the page-synthesized injected fixtures. Both harness modes run in
// the same browser and decode the same fixed bytes, so the comparison stays a
// true backend-vs-backend diff at tolerance 0 / ssim-min 1.
//
// The transcript opens with the GPU renderer string the sweep actually used, so
// a saved log is source-bound to its platform (a pixel transcript with no
// renderer line cannot later be attributed to a host).
//
// Usage: node parity/sweep-live-inputs.mjs   (exit 0 iff every case passes)

import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromiumLaunchArgs } from './launch-args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

async function printPlatform() {
  let browser = null
  try {
    browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 120000 })
    const page = await browser.newPage()
    await page.goto('about:blank')
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      if (!gl) return null
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    })
    process.stdout.write(`[platform] ${renderer || 'unknown renderer'}\n`)
  } catch (error) {
    process.stdout.write(`[platform] renderer probe failed: ${error?.message || error}\n`)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

// Sequential on purpose: the renderer line must head the transcript.
await printPlatform()
const r = spawnSync(process.execPath, [join(here, 'timeseries.mjs'), '--batch-manifest', join(here, 'live-inputs.manifest.json')], { stdio: 'inherit', cwd: repoRoot })
process.exit(r.status ?? 1)
