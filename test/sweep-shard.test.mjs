import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

// The windows programs gate is sharded (--shard i/N, round-robin over the
// sorted fixture list). This suite asserts the partition property with a
// stubbed batched time-series runner (no browser): the shard ledgers must be
// disjoint and together cover every selected fixture exactly once, and the
// per-shard denominators must sum to the fixture count.
const FIXTURES = 12
const SHARDS = 3

function stubTimeseries () {
  return `
import { readFileSync } from 'node:fs'
const argv = process.argv.slice(2)
const i = argv.indexOf('--batch-manifest')
const manifest = JSON.parse(readFileSync(argv[i + 1], 'utf8'))
for (const c of manifest.cases) {
  const name = c.dslPath.split('/').pop().replace(/\\.dsl$/, '')
  console.log('[PASS] ' + name + '@f1: max-abs-diff=0.000 mean-abs-diff=0.0000 ssim=1.00000 (tol=0.0, ssim_min=1.0)')
  console.log('[ts] ' + name + ': worst max-abs-diff across 1 samples = 0')
}
`
}

for (const scenario of ['cover', 'disjoint', 'count', 'invalid-shard']) {
  test(`programs sweep shard partition: ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'nm-sweep-shard-'))
    try {
      for (const dir of ['parity', 'parity/out', 'parity/programs', 'vendor/noisemaker/effects']) mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(join(root, 'vendor/noisemaker/effects/manifest.json'), readFileSync(new URL('../vendor/noisemaker/effects/manifest.json', import.meta.url)))
      for (let k = 0; k < FIXTURES; k++) {
        writeFileSync(join(root, 'parity/programs', `fx${String(k).padStart(2, '0')}.dsl`), 'noise().write(o0)\n')
      }
      writeFileSync(join(root, 'parity/sweep-programs.mjs'), readFileSync(new URL('../parity/sweep-programs.mjs', import.meta.url)))
      writeFileSync(join(root, 'parity/current-programs.mjs'), readFileSync(new URL('../parity/current-programs.mjs', import.meta.url)))
      writeFileSync(join(root, 'parity/timeseries-stub.mjs'), stubTimeseries())
      const ledgers = []
      for (let i = 0; i < SHARDS; i++) {
        const run = spawnSync('node', [join(root, 'parity/sweep-programs.mjs'), '--shard', `${i}/${SHARDS}`], {
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, NM_TIMESERIES_SCRIPT: join(root, 'parity/timeseries-stub.mjs') },
        })
        assert.equal(run.status, 0, run.stdout + run.stderr)
        assert.ok(run.stdout.includes(`shard=${i}/${SHARDS}`), run.stdout)
        ledgers.push(JSON.parse(readFileSync(join(root, 'parity/out', `mode-ledger.shard${i}of${SHARDS}.json`), 'utf8')))
      }
      if (scenario === 'cover') {
        const union = new Set(ledgers.flatMap((l) => Object.keys(l)))
        assert.equal(union.size, FIXTURES)
        for (let k = 0; k < FIXTURES; k++) assert.ok(union.has(`fx${String(k).padStart(2, '0')}`))
      }
      if (scenario === 'disjoint') {
        const seen = new Set()
        for (const l of ledgers) {
          for (const name of Object.keys(l)) {
            assert.ok(!seen.has(name), `fixture rendered twice: ${name}`)
            seen.add(name)
          }
        }
      }
      if (scenario === 'count') {
        assert.equal(ledgers.reduce((sum, l) => sum + Object.keys(l).length, 0), FIXTURES)
      }
      if (scenario === 'invalid-shard') {
        const run = spawnSync('node', [join(root, 'parity/sweep-programs.mjs'), '--shard', `${SHARDS}/${SHARDS}`], {
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, NM_TIMESERIES_SCRIPT: join(root, 'parity/timeseries-stub.mjs') },
        })
        assert.notEqual(run.status, 0)
        assert.ok(run.stderr.includes('invalid --shard'), run.stderr)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
