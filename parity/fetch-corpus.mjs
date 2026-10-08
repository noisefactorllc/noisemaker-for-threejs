#!/usr/bin/env node
// fetch-corpus.mjs — pull real DSL programs from the live noisedeck corpus
// (blaster.noisedeck.app feed -> sharing.noisedeck.app composition DSL) into
// parity/corpus/<code>.dsl for parity validation. Read-only; public gallery.
// A program that calls user.* effects is published with their Portable
// definitions; those are kept in parity/corpus/<code>.effects.json, which the
// time-series harness registers before it compiles the program. Without them
// the reference engine cannot compile the program (S001 unknown effect).
//
// Usage: node fetch-corpus.mjs [count]   (default: ALL — paginate the whole feed)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const corpusDir = resolve(__dirname, 'corpus')
mkdirSync(corpusDir, { recursive: true })

const argv = process.argv.slice(2)
const cap = Number(argv.find((a) => !a.startsWith('--'))) || Infinity

const FEED = 'https://blaster.noisedeck.app/api/feed'
const COMP = 'https://sharing.noisedeck.app/api/composition'

async function main() {
  // Paginate the whole feed (capped at `cap` programs).
  const comps = []
  for (let page = 0; comps.length < cap; page++) {
    const feed = await (await fetch(`${FEED}?page=${page}&limit=50`)).json()
    const batch = feed.compositions || []
    comps.push(...batch)
    process.stdout.write(`[corpus] feed page ${page}: +${batch.length} (have ${comps.length}/${feed.total})\n`)
    if (!feed.hasMore || batch.length === 0) break
  }
  const manifest = []
  for (const c of comps.slice(0, cap)) {
    try {
      const data = await (await fetch(`${COMP}/${c.code}`)).json()
      if (!data.dsl) {
        process.stdout.write(`[corpus] ${c.code} "${c.title}": no dsl, skip\n`)
        continue
      }
      const safe = c.code.replace(/[^a-zA-Z0-9_-]/g, '_')
      writeFileSync(resolve(corpusDir, `${safe}.dsl`), data.dsl)
      if (Array.isArray(data.effects) && data.effects.length) {
        const sidecar = { source: `${COMP}/${c.code}`, effects: data.effects }
        writeFileSync(resolve(corpusDir, `${safe}.effects.json`), JSON.stringify(sidecar, null, 2) + '\n')
      } else if (data.hasEffects) {
        process.stdout.write(`[corpus] ${c.code} "${c.title}": hasEffects but no effects served\n`)
      }
      manifest.push({ code: c.code, file: `${safe}.dsl`, title: c.title })
    } catch (e) {
      process.stdout.write(`[corpus] ${c.code} fetch failed: ${e?.message || e}\n`)
    }
  }
  writeFileSync(resolve(corpusDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  process.stdout.write(`[corpus] wrote ${manifest.length} programs + manifest.json\n`)
}
main()
