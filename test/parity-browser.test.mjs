import assert from 'node:assert/strict'
import test from 'node:test'
import * as launch from '../parity/launch-args.mjs'

test('the default parity browser keeps the Chromium launch configuration', () => {
  const { browserType, launchOptions } = launch.parityBrowserConfig('chromium')
  assert.equal(browserType.name(), 'chromium')
  assert.deepEqual(launchOptions, {
    headless: true,
    args: launch.chromiumLaunchArgs(),
    timeout: 120000,
  })
})

test('Firefox parity launches without Chromium command-line flags', () => {
  const { browserType, launchOptions } = launch.parityBrowserConfig('firefox')
  assert.equal(browserType.name(), 'firefox')
  assert.deepEqual(launchOptions, { headless: true, timeout: 120000 })
})

test('the parity browser selector rejects an unsupported browser', () => {
  assert.throws(() => launch.parityBrowserConfig('webkit'), /NM_BROWSER/)
})

test('NM_BROWSER selects Firefox and an unset value defaults to Chromium', () => {
  const previous = process.env.NM_BROWSER
  try {
    process.env.NM_BROWSER = 'firefox'
    assert.equal(launch.parityBrowserConfig().browserType.name(), 'firefox')
    delete process.env.NM_BROWSER
    assert.equal(launch.parityBrowserConfig().browserType.name(), 'chromium')
  } finally {
    if (previous === undefined) delete process.env.NM_BROWSER
    else process.env.NM_BROWSER = previous
  }
})
