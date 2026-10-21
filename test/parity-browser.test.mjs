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

test('NM_PARITY_BROWSER_EXECUTABLE names the chromium executable without changing the rest of the launch options', () => {
  const previous = process.env.NM_PARITY_BROWSER_EXECUTABLE
  try {
    process.env.NM_PARITY_BROWSER_EXECUTABLE = '/browsers/chrome-headless-shell'
    const { launchOptions } = launch.parityBrowserConfig('chromium')
    assert.equal(launchOptions.executablePath, '/browsers/chrome-headless-shell')
    assert.deepEqual(launchOptions.args, launch.chromiumLaunchArgs())
    assert.equal(launchOptions.timeout, 120000)
  } finally {
    if (previous === undefined) delete process.env.NM_PARITY_BROWSER_EXECUTABLE
    else process.env.NM_PARITY_BROWSER_EXECUTABLE = previous
  }
})

test('Firefox parity launches without Chromium command-line flags', () => {
  const { browserType, launchOptions } = launch.parityBrowserConfig('firefox')
  assert.equal(browserType.name(), 'firefox')
  assert.deepEqual(launchOptions, { headless: true, timeout: 120000 })
})

test('Safari parity drives real Safari through safaridriver with the console recorder', async () => {
  const { CONSOLE_RECORDER } = await import('../parity/safari-webdriver.mjs')
  const { browserType, launchOptions, pageInitScript } = launch.parityBrowserConfig('safari')
  assert.equal(browserType.name(), 'safari')
  assert.deepEqual(launchOptions, { timeout: 120000 })
  assert.equal(pageInitScript, CONSOLE_RECORDER)
  assert.equal(launch.parityBrowserConfig('chromium').pageInitScript, undefined)
  assert.equal(launch.parityBrowserConfig('firefox').pageInitScript, undefined)
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
