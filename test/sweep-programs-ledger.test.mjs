import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const canonical = join(root, 'parity', 'out', 'mode-ledger.json')
const filter = '__ledger_path_contract_no_match__'
const partial = join(root, 'parity', 'out', `mode-ledger.${filter}.json`)

test('a filtered sweep with no matching fixtures fails without writing evidence', () => {
  const hadCanonical = existsSync(canonical)
  const previous = hadCanonical ? readFileSync(canonical) : null
  const sentinel = '{"full":"ledger"}\n'
  writeFileSync(canonical, sentinel)
  rmSync(partial, { force: true })

  try {
    const result = spawnSync(process.execPath, [join(root, 'parity', 'sweep-programs.mjs'), '--filter', filter], { encoding: 'utf8' })
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(readFileSync(canonical, 'utf8'), sentinel)
    assert.equal(existsSync(partial), false)
  } finally {
    rmSync(partial, { force: true })
    if (hadCanonical) writeFileSync(canonical, previous)
    else rmSync(canonical, { force: true })
  }
})

test('a comparator PASS line with a nonzero byte delta fails the sweep', () => {
  const temp = mkdtempSync(join(tmpdir(), 'noisemaker-threejs-exactness-test-'))
  const name = `${filter}_nonzero_delta`
  const program = join(root, 'parity', 'programs', `${name}.dsl`)
  const partialLedger = join(root, 'parity', 'out', `mode-ledger.${filter}.json`)
  const fake = join(temp, 'fake-timeseries.mjs')
  writeFileSync(fake, [
    `console.log('[PASS] ${name}@f1: max-abs-diff=1 mean-abs-diff=0.1 ssim=1')`,
    `console.log('[ts] ${name}: worst max-abs-diff across 1 samples = 1')`,
  ].join('\n'))
  writeFileSync(program, 'noise().write(o0)\n')

  try {
    const result = spawnSync(process.execPath, [join(root, 'parity', 'sweep-programs.mjs'), '--filter', filter], {
      encoding: 'utf8',
      env: { ...process.env, NM_TIMESERIES_SCRIPT: fake },
    })
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const ledger = JSON.parse(readFileSync(partialLedger, 'utf8'))
    assert.equal(ledger[name].status, 'FAIL')
    assert.equal(ledger[name].maxAbsDiff, 1)
  } finally {
    rmSync(program, { force: true })
    rmSync(partialLedger, { force: true })
    rmSync(temp, { recursive: true, force: true })
  }
})

test('multiple fixtures use one batched time-series runner invocation', () => {
  const temp = mkdtempSync(join(tmpdir(), 'noisemaker-threejs-batch-test-'))
  const names = [`${filter}_a`, `${filter}_b`]
  const programs = names.map((name) => join(root, 'parity', 'programs', `${name}.dsl`))
  const partialLedger = join(root, 'parity', 'out', `mode-ledger.${filter}.json`)
  const fake = join(temp, 'fake-timeseries.mjs')
  const launches = join(temp, 'launches.txt')
  writeFileSync(fake, [
    "import { appendFileSync, readFileSync } from 'node:fs'",
    "import { basename } from 'node:path'",
    "appendFileSync(process.env.NM_LAUNCH_LOG, 'launch\\n')",
    "const i = process.argv.indexOf('--batch-manifest')",
    "const manifest = JSON.parse(readFileSync(process.argv[i + 1], 'utf8'))",
    "for (const item of manifest.cases) {",
    "  const name = basename(item.dslPath, '.dsl')",
    "  console.log(`[PASS] ${name}@f1: max-abs-diff=0 mean-abs-diff=0 ssim=1`)",
    "  console.log(`[ts] ${name}: worst max-abs-diff across 1 samples = 0`)",
    "}",
  ].join('\n'))
  for (const program of programs) writeFileSync(program, 'noise().write(o0)\n')

  try {
    const result = spawnSync(process.execPath, [join(root, 'parity', 'sweep-programs.mjs'), '--filter', filter], {
      encoding: 'utf8',
      env: { ...process.env, NM_TIMESERIES_SCRIPT: fake, NM_LAUNCH_LOG: launches },
    })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(readFileSync(launches, 'utf8').trim().split('\n'), ['launch'])
    const ledger = JSON.parse(readFileSync(partialLedger, 'utf8'))
    assert.deepEqual(Object.keys(ledger).sort(), names.sort())
  } finally {
    for (const program of programs) rmSync(program, { force: true })
    rmSync(partialLedger, { force: true })
    rmSync(temp, { recursive: true, force: true })
  }
})

test('a nonzero batched time-series exit cannot be reported as a passing sweep', () => {
  const temp = mkdtempSync(join(tmpdir(), 'noisemaker-threejs-batch-exit-test-'))
  const name = `${filter}_child_exit`
  const program = join(root, 'parity', 'programs', `${name}.dsl`)
  const partialLedger = join(root, 'parity', 'out', `mode-ledger.${filter}.json`)
  const fake = join(temp, 'fake-timeseries.mjs')
  writeFileSync(fake, [
    `console.log('[PASS] ${name}@f1: max-abs-diff=0 mean-abs-diff=0 ssim=1')`,
    `console.log('[ts] ${name}: worst max-abs-diff across 1 samples = 0')`,
    'process.exit(7)',
  ].join('\n'))
  writeFileSync(program, 'noise().write(o0)\n')

  try {
    const result = spawnSync(process.execPath, [join(root, 'parity', 'sweep-programs.mjs'), '--filter', filter], {
      encoding: 'utf8',
      env: { ...process.env, NM_TIMESERIES_SCRIPT: fake },
    })
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout + result.stderr, /batched time-series runner exited 7/)
  } finally {
    rmSync(program, { force: true })
    rmSync(partialLedger, { force: true })
    rmSync(temp, { recursive: true, force: true })
  }
})

test('text parity uses a deterministic no-font external texture', () => {
  const sidecar = JSON.parse(readFileSync(join(root, 'parity', 'programs', 'text.inject.json'), 'utf8'))
  const dsl = readFileSync(join(root, 'parity', 'programs', 'text.dsl'), 'utf8')
  assert.equal(sidecar.image.size, 1024)
  assert.match(sidecar._comment, /no fonts/)
  assert.match(dsl, /text\(matteColor: #000000\)/)
})
