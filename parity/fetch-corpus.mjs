#!/usr/bin/env node
// fetch-corpus.mjs — pull real DSL programs from the live noisedeck corpus
// (blaster.noisedeck.app feed -> sharing.noisedeck.app composition DSL) into
// parity/corpus/<code>.dsl for parity validation. Read-only; public gallery.
//
// Usage: node fetch-corpus.mjs [count] [--page N]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const corpusDir = resolve(__dirname, 'corpus')
mkdirSync(corpusDir, { recursive: true })

const argv = process.argv.slice(2)
const count = Number(argv.find((a) => !a.startsWith('--'))) || 20
const pageI = argv.indexOf('--page')
const page = pageI >= 0 ? Number(argv[pageI + 1]) : 0

const FEED = 'https://blaster.noisedeck.app/api/feed'
const COMP = 'https://sharing.noisedeck.app/api/composition'

async function main() {
  const limit = Math.min(50, count)
  const feed = await (await fetch(`${FEED}?page=${page}&limit=${limit}`)).json()
  const comps = feed.compositions || []
  process.stdout.write(`[corpus] feed page ${page}: ${comps.length} compositions (global total ${feed.total})\n`)
  const manifest = []
  for (const c of comps.slice(0, count)) {
    try {
      const data = await (await fetch(`${COMP}/${c.code}`)).json()
      if (!data.dsl) {
        process.stdout.write(`[corpus] ${c.code} "${c.title}": no dsl, skip\n`)
        continue
      }
      const safe = c.code.replace(/[^a-zA-Z0-9_-]/g, '_')
      writeFileSync(resolve(corpusDir, `${safe}.dsl`), data.dsl)
      manifest.push({ code: c.code, file: `${safe}.dsl`, title: c.title })
      process.stdout.write(`[corpus] ${c.code} "${c.title}" -> ${safe}.dsl (${data.dsl.length}b)\n`)
    } catch (e) {
      process.stdout.write(`[corpus] ${c.code} fetch failed: ${e?.message || e}\n`)
    }
  }
  writeFileSync(resolve(corpusDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  process.stdout.write(`[corpus] wrote ${manifest.length} programs + manifest.json\n`)
}
main()
