// Red/green tests for the explicit blocked-cases exception in
// scripts/verify-shards.mjs: a recorded blocked case is optional coverage
// (absent ledgers are fine, a rendered ledger counts), everything else must
// still be covered exactly once.
//
// Fixture ledgers are built in-process from the real fixture set; only
// verify-shards.mjs itself is spawned.
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { currentPrograms } from '../parity/current-programs.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const script = join(root, 'scripts', 'verify-shards.mjs')
const expected = currentPrograms(readdirSync(join(root, 'parity', 'programs')).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))

function ledgerWith(names) {
  return JSON.stringify(Object.fromEntries(names.map((n) => [n, { pass: true }])))
}

function runWith(env, ledgers) {
  return spawnSync(process.execPath, [script, ...ledgers], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

test('a ledger covering every current fixture passes with no blocked cases', () => {
  const temp = mkdtempSync(join(tmpdir(), 'verify-shards-test-'))
  const ledgerPath = join(temp, 'full.json')
  writeFileSync(ledgerPath, ledgerWith(expected))

  const ok = runWith({}, [ledgerPath])
  assert.equal(ok.status, 0, `${ok.stdout}\n${ok.stderr}`)
  assert.match(ok.stdout, /SHARD COVERAGE OK: \d+\/\d+ fixtures/)
})

test('a blocked case may be absent, and its absence is announced', () => {
  const temp = mkdtempSync(join(tmpdir(), 'verify-shards-test-'))
  const ledgerPath = join(temp, 'minus-octaveWarp.json')
  writeFileSync(ledgerPath, ledgerWith(expected.filter((n) => n !== 'octaveWarp')))

  const blocked = runWith({ NM_BLOCKED_CASES: 'octaveWarp' }, [ledgerPath])
  assert.equal(blocked.status, 0, `${blocked.stdout}\n${blocked.stderr}`)
  assert.match(blocked.stdout, /BLOCKED \(recorded, not rendered on this platform\): octaveWarp/)
  assert.match(blocked.stdout, /SHARD COVERAGE OK:/)

  // Red: the same ledger without the blocked-case env fails on the missing fixture.
  const strict = runWith({}, [ledgerPath])
  assert.notEqual(strict.status, 0)
  assert.match(strict.stdout + strict.stderr, /fixtures missing from the shard ledgers: octaveWarp/)
})

test('a blocked case that IS rendered still counts toward full coverage', () => {
  const temp = mkdtempSync(join(tmpdir(), 'verify-shards-test-'))
  const ledgerPath = join(temp, 'full.json')
  writeFileSync(ledgerPath, ledgerWith(expected))

  const rendered = runWith({ NM_BLOCKED_CASES: 'octaveWarp' }, [ledgerPath])
  assert.equal(rendered.status, 0, `${rendered.stdout}\n${rendered.stderr}`)
  assert.doesNotMatch(rendered.stdout, /BLOCKED/)
  assert.match(rendered.stdout, /SHARD COVERAGE OK:/)
})