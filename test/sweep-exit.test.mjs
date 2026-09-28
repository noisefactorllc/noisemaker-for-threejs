import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

for (const sweep of ['stateful', 'corpus']) {
  for (const scenario of ['pass', 'mismatch', 'missing', 'child-exit', 'failed-sample']) {
    test(`${sweep} sweep ${scenario} preserves the child gate verdict`, () => {
      const root = mkdtempSync(join(tmpdir(), 'nm-sweep-exit-'))
      try {
        for (const dir of ['parity', 'parity/out', 'parity/programs', 'parity/corpus']) mkdirSync(join(root, dir), { recursive: true })
        const script = join(root, 'parity', `sweep-${sweep}.sh`)
        writeFileSync(script, readFileSync(new URL(`../parity/sweep-${sweep}.sh`, import.meta.url)))
        writeFileSync(join(root, 'parity/programs/probe.dsl'), 'noise().write(o0)\n')
        writeFileSync(join(root, 'parity/corpus/probe.dsl'), 'noise().write(o0)\n')
        const delta = scenario === 'mismatch' ? 3 : 0
        writeFileSync(join(root, 'parity/timeseries.mjs'), scenario === 'missing' ? '' : [
          `console.log('[${scenario === 'failed-sample' || delta ? 'FAIL' : 'PASS'}] probe@f15: max-abs-diff=${delta} mean-abs-diff=0 ssim=1')`,
          `console.log('[ts] probe: worst max-abs-diff across 1 samples = ${delta}')`,
          `process.exit(${scenario === 'child-exit' ? 7 : 0})`,
        ].join('\n'))
        const run = spawnSync('bash', [script, ...(sweep === 'stateful' ? ['probe'] : [])], { encoding: 'utf8', timeout: 10000 })
        assert.equal(run.error, undefined)
        if (scenario === 'pass') assert.equal(run.status, 0, run.stdout + run.stderr)
        else assert.notEqual(run.status, 0, run.stdout + run.stderr)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  }
}
// Corpus-only: the golden-side S001 compile-failure ERR set is documented and
// tolerated ONLY for the seven whitelisted programs; the same failure on the
// candidate side, or on any non-whitelisted program, must fail the gate.
for (const scenario of ['golden-err-whitelisted', 'golden-err', 'candidate-err']) {
  test(`corpus sweep ${scenario} preserves the child gate verdict`, () => {
    const root = mkdtempSync(join(tmpdir(), 'nm-sweep-exit-'))
    try {
      for (const dir of ['parity', 'parity/out', 'parity/corpus']) mkdirSync(join(root, dir), { recursive: true })
      const script = join(root, 'parity', 'sweep-corpus.sh')
      writeFileSync(script, readFileSync(new URL('../parity/sweep-corpus.sh', import.meta.url)))
      const name = scenario === 'golden-err-whitelisted' ? '4bm9AA' : 'probe'
      writeFileSync(join(root, `parity/corpus/${name}.dsl`), 'noise().write(o0)\n')
      writeFileSync(join(root, 'parity/timeseries.mjs'), [
        `console.error('[${scenario === 'candidate-err' ? 'candidate' : 'golden'}] ERROR: {"code":"ERR_COMPILATION_FAILED","diagnostics":[{"code":"S001"}]}')`,
        'process.exit(1)',
      ].join('\n'))
      const run = spawnSync('bash', [script, '1', '1', '8'], { encoding: 'utf8', timeout: 10000 })
      assert.equal(run.error, undefined)
      if (scenario === 'golden-err-whitelisted') assert.equal(run.status, 0, run.stdout + run.stderr)
      else assert.notEqual(run.status, 0, run.stdout + run.stderr)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
