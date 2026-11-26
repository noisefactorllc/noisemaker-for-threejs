import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Execute the harness's actual cleanup function in an isolated process so a
// forgotten timer is visible as a process that cannot exit after cleanup.
const source = readFileSync(new URL('../parity/timeseries.mjs', import.meta.url), 'utf8')
const cleanup = source.match(/async function closeBrowser\(browser\) \{[\s\S]*?\n\}\n\nlet browserName/)
assert.ok(cleanup, 'the harness cleanup function must be found')
const implementation = cleanup[0].replace(/\n\nlet browserName$/, '')

function runCleanup(close, timeout) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    ${implementation}
    const started = performance.now()
    await closeBrowser({
      close: ${close},
      process: () => ({ kill: signal => console.log(signal) }),
    })
    console.log(performance.now() - started)
  `], { encoding: 'utf8', timeout })
}

test('successful browser cleanup lets its process exit promptly', () => {
  const result = runCleanup('async () => {}', 2000)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.ok(Number(result.stdout.trim().split('\n').at(-1)) < 1000, result.stdout)
})

test('a hung browser close still reaches its cleanup fallback after thirty seconds', { timeout: 40000 }, () => {
  const result = runCleanup('() => new Promise(() => {})', 37000)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  const [signal, elapsed] = result.stdout.trim().split('\n')
  assert.equal(signal, 'SIGKILL')
  assert.ok(Number(elapsed) >= 29900 && Number(elapsed) < 37000, result.stdout)
})
