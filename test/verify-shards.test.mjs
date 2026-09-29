// Red/green tests for the explicit blocked-cases exception in
// scripts/verify-shards.mjs: a recorded blocked case is optional coverage
// (absent ledgers are fine, a rendered ledger counts), everything else must
// still be covered exactly once.
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const script = join(root, 'scripts', 'verify-shards.mjs')

function runWith(env, ledgers) {
  return spawnSync(process.execPath, [script, ...ledgers], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

test('a ledger covering every current fixture passes with no blocked cases', () => {
  const temp = mkdtempSync(join(tmpdir(), 'verify-shards-test-'))
  const ledgerPath = join(temp, 'ledger.json')
  // Build a full ledger from the real fixture set via the current-programs
  // module, same as the script does.
  const manifest = JSON.parse(spawnSync(process.execPath, ['-e', `
    const { currentPrograms } = await import(${JSON.stringify(join(root, 'parity', 'current-programs.mjs'))})
    const { readdirSync } = await import('node:fs')
    const { basename, join } = await import('node:path')
    const dir = ${JSON.stringify(join(root, 'parity', 'programs'))}
    const expected = currentPrograms(readdirSync(dir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))
    console.log(JSON.stringify(Object.fromEntries(expected.map((n) => [n, { pass: true }]))))
  `], { encoding: 'utf8' }).stdout)
  writeFileSync(ledgerPath, JSON.stringify(manifest))

  const ok = runWith({}, [ledgerPath])
  assert.equal(ok.status, 0, `${ok.stdout}\n${ok.stderr}`)
  assert.match(ok.stdout, /SHARD COVERAGE OK: \d+\/\d+ fixtures/)
})

test('a blocked case may be absent, and its absence is announced', () => {
  const temp = mkdtempSync(join(tmpdir(), 'verify-shards-test-'))
  const ledgerPath = join(temp, 'ledger.json')
  const output = spawnSync(process.execPath, ['-e', `
    const { currentPrograms } = await import(${JSON.stringify(join(root, 'parity', 'current-programs.mjs'))})
    const { readdirSync } = await import('node:fs')
    const { basename, join } = await import('node:path')
    const dir = ${JSON.stringify(join(root, 'parity', 'programs'))}
    let expected = currentPrograms(readdirSync(dir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))
    expected = expected.filter((n) => n !== 'octaveWarp')
    console.log(JSON.stringify(Object.fromEntries(expected.map((n) => [n, { pass: true }]))))
  `], { encoding: 'utf8' }).stdout
  writeFileSync(ledgerPath, output)

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
  const ledgerPath = join(temp, 'ledger.json')
  const output = spawnSync(process.execPath, ['-e', `
    const { currentPrograms } = await import(${JSON.stringify(join(root, 'parity', 'current-programs.mjs'))})
    const { readdirSync } = await import('node:fs')
    const { basename, join } = await import('node:path')
    const dir = ${JSON.stringify(join(root, 'parity', 'programs'))}
    const expected = currentPrograms(readdirSync(dir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl')))
    console.log(JSON.stringify(Object.fromEntries(expected.map((n) => [n, { pass: true }]))))
  `], { encoding: 'utf8' }).stdout
  writeFileSync(ledgerPath, output)

  const rendered = runWith({ NM_BLOCKED_CASES: 'octaveWarp' }, [ledgerPath])
  assert.equal(rendered.status, 0, `${rendered.stdout}\n${rendered.stderr}`)
  assert.doesNotMatch(rendered.stdout, /BLOCKED/)
  assert.match(rendered.stdout, /SHARD COVERAGE OK:/)
})
