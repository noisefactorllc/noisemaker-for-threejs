// Verifies sharded rendered-parity ledger coverage: the union of the shard
// ledgers' fixtures must equal the current fixture set exactly (no case
// executed twice, none missed), so the gate denominator is the full corpus.
//
// Usage: node scripts/verify-shards.mjs <ledger.json...>
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentPrograms } from '../parity/current-programs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const progDir = join(__dirname, '..', 'parity', 'programs')
const expected = currentPrograms(readdirSync(progDir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))

const ledgerPaths = process.argv.slice(2)
assert.ok(ledgerPaths.length > 0, 'usage: verify-shards.mjs <ledger.json...>')

// Cases that a platform is recorded-blocked on render (documented in the gap
// record, e.g. octaveWarp on windows-hosted SwiftShader) are OPTIONAL: they
// need not appear in any ledger, and if a ledger does render one it counts
// toward full coverage. Every other fixture must appear exactly once. The
// exception is explicit and enforced here — never a silent denominator drop.
const blocked = new Set((process.env.NM_BLOCKED_CASES || '').split(',').map((s) => s.trim()).filter(Boolean))

const seen = new Map()
for (const path of ledgerPaths) {
  const ledger = JSON.parse(readFileSync(path, 'utf8'))
  for (const name of Object.keys(ledger)) {
    assert.ok(!seen.has(name), `fixture rendered twice across shards: ${name} (already in ${seen.get(name)})`)
    seen.set(name, path)
  }
}
const missing = expected.filter((name) => !seen.has(name) && !blocked.has(name))
assert.equal(missing.length, 0, `fixtures missing from the shard ledgers: ${missing.join(', ')}`)
const blockedMissing = [...blocked].filter((name) => !seen.has(name))
if (blockedMissing.length > 0) {
  console.log(`BLOCKED (recorded, not rendered on this platform): ${blockedMissing.join(', ')}`)
}
assert.equal(seen.size, expected.length - blockedMissing.length, `ledger union ${seen.size} != expected coverage ${expected.length - blockedMissing.length}`)
console.log(`SHARD COVERAGE OK: ${seen.size}/${expected.length} fixtures, disjoint, no misses`)
