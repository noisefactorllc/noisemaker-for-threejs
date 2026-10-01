#!/usr/bin/env node
// gen-live-assets.mjs — regenerate the committed live-input fixtures.
//
// These assets feed parity's LIVE external-input cases (GAP-004): unlike the
// injected fixtures, the harness page does not draw them — the browser's own
// decoders (PNG image decode, WAV audio decode) produce the bytes that reach
// updateTextureFromSource / setAudioState. The contents are still fully
// deterministic (pure functions of fixed constants, no fonts, no AA), so both
// harness modes decode byte-identical sources.
//
// Usage: node parity/assets/gen-live-assets.mjs  (writes live-media.png and
// live-audio.wav next to this script). Run from anywhere.

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- PNG (1024²)
// Same gradient + geometric-shapes pattern as the injected media fixture, but
// encoded once as a real PNG file so the browser's image decoder produces the
// source pixels.
const S = 1024
const rgba = Buffer.alloc(S * S * 4)
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4
    const fx = x / S
    const fy = y / S
    // Linear gradient corner-to-corner (matches the injected pattern's ramp).
    let r = 0x10 + (0xe0 - 0x10) * ((fx + fy) / 2)
    let g = 0x20 + (0x80 - 0x20) * ((fx + fy) / 2)
    let b = 0x38 + (0x40 - 0x38) * ((fx + fy) / 2)
    // Red square.
    if (x >= S * 0.12 && x < S * 0.46 && y >= S * 0.12 && y < S * 0.46) { r = 0xff; g = 0x30; b = 0x50 }
    // Blue disc.
    const dx = x - S * 0.68, dy = y - S * 0.4
    if (dx * dx + dy * dy <= (S * 0.18) ** 2) { r = 0x30; g = 0xc0; b = 0xff }
    // Yellow bar.
    if (x >= S * 0.28 && x < S * 0.78 && y >= S * 0.62 && y < S * 0.78) { r = 0xff; g = 0xe0; b = 0x20 }
    // Green triangle (edge functions, no AA).
    const ax = S * 0.2, ay = S * 0.9, bx = S * 0.5, by = S * 0.55, cx = S * 0.8, cy = S * 0.9
    const px = x + 0.5, py = y + 0.5
    const w0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    const w1 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
    const w2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
    if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) { r = 0x20; g = 0xff; b = 0x80 }
    rgba[o] = Math.round(r); rgba[o + 1] = Math.round(g); rgba[o + 2] = Math.round(b); rgba[o + 3] = 255
  }
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 }
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
// Filter type 0 rows, flipping to top-down first (PNG rows start at the top).
const raw = Buffer.alloc((S * 4 + 1) * S)
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0
  rgba.copy(raw, y * (S * 4 + 1) + 1, (S - 1 - y) * S * 4, (S - y) * S * 4)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(join(outDir, 'live-media.png'), png)

// ---------------------------------------------------------------- WAV (0.5 s)
// Mono 16-bit PCM at 44100 Hz: three summed sines with a fixed envelope. The
// harness decodes this with the browser's audio decoder and derives the 128-point
// waveform/spectrum from the decoded samples (shared deterministic code).
const RATE = 44100
const SECONDS = 0.5
const n = Math.round(RATE * SECONDS)
const pcm = Buffer.alloc(n * 2)
for (let i = 0; i < n; i++) {
  const t = i / RATE
  const env = 1 - i / n
  const v = 0.45 * Math.sin(2 * Math.PI * 220 * t)
    + 0.30 * Math.sin(2 * Math.PI * 554.37 * t)
    + 0.25 * Math.sin(2 * Math.PI * 1318.51 * t)
  const s = Math.max(-1, Math.min(1, v * env))
  pcm.writeInt16LE(Math.round(s * 32767), i * 2)
}
const wav = Buffer.alloc(44 + pcm.length)
wav.write('RIFF', 0, 'ascii'); wav.writeUInt32LE(36 + pcm.length, 4); wav.write('WAVE', 8, 'ascii')
wav.write('fmt ', 12, 'ascii'); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22); wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28)
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36, 'ascii'); wav.writeUInt32LE(pcm.length, 40)
pcm.copy(wav, 44)
writeFileSync(join(outDir, 'live-audio.wav'), wav)

// ---------------------------------------------------------------- OBJ (cube)
// Same CCW-outward unit cube as the page's CUBE constant: 8 vertices, 12
// triangles (quads split abc/acd). The live fixture fetches this file through
// the browser's real fetch path; the harness page parses it (the published
// bundle's parseOBJ is internal-only).
const cubeC = [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5],[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]]
const cubeFaces = [[0,1,2,3],[1,5,6,2],[5,4,7,6],[4,0,3,7],[3,2,6,7],[4,5,1,0]]
const objLines = ['# Live mesh fixture (GAP-004): CCW-outward unit cube, generated by']
objLines.push('# parity/assets/gen-live-assets.mjs (same geometry as the injected cube fixture).')
for (const c of cubeC) objLines.push(`v ${c[0]} ${c[1]} ${c[2]}`)
for (const f of cubeFaces) objLines.push(`f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1} ${f[3] + 1}`)
writeFileSync(join(outDir, 'live-mesh.obj'), objLines.join('\n') + '\n')

console.log(`wrote ${join(outDir, 'live-media.png')} (${png.length} bytes), ${join(outDir, 'live-audio.wav')} (${wav.length} bytes) and ${join(outDir, 'live-mesh.obj')} (${objLines.length} lines)`)