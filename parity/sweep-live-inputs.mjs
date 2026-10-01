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
// Usage: node parity/sweep-live-inputs.mjs   (exit 0 iff every case passes)

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const r = spawnSync(process.execPath, [join(here, 'timeseries.mjs'), '--batch-manifest', join(here, 'live-inputs.manifest.json')], { stdio: 'inherit', cwd: repoRoot })
process.exit(r.status ?? 1)