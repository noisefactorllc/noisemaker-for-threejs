// The Safari WebDriver shim behind NM_BROWSER=safari (parity/safari-webdriver.mjs).
// A stand-in safaridriver serves the W3C endpoints the shim uses and runs each
// script it receives in Node against a fake window, so the shim's request,
// evaluate, console relay and session lifecycle are exercised without Safari.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { CONSOLE_RECORDER, safari } from '../parity/safari-webdriver.mjs'

const FAKE_DRIVER = `
import { createServer } from 'node:http'
const port = Number(process.argv[process.argv.indexOf('--port') + 1])
let active = null
let opened = 0
const visited = []
globalThis.window = { __nm_console: [{ type: 'error', text: 'boom' }, { type: 'warning', text: 'careful' }, { type: 'pageerror', text: 'uncaught' }] }
const send = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ value })) }
createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    const json = body ? JSON.parse(body) : {}
    const parts = req.url.split('/').filter(Boolean)
    if (req.method === 'GET' && req.url === '/status') return send(res, 200, { ready: true })
    if (req.method === 'GET' && req.url === '/visited') return send(res, 200, { visited, opened })
    if (req.method === 'POST' && req.url === '/session') {
      if (active) return send(res, 500, { error: 'session not created', message: 'one session at a time' })
      if (json.capabilities?.alwaysMatch?.browserName !== 'safari') return send(res, 400, { error: 'invalid argument', message: 'browserName' })
      active = 'session-' + (++opened)
      return send(res, 200, { sessionId: active, capabilities: { browserName: 'Safari', browserVersion: '26.0' } })
    }
    if (parts[0] !== 'session' || parts[1] !== active) return send(res, 404, { error: 'invalid session id', message: req.url })
    const command = parts.slice(2).join('/')
    if (req.method === 'DELETE' && command === '') { active = null; return send(res, 200, null) }
    if (command === 'timeouts') return send(res, 200, null)
    if (command === 'url') { visited.push(json.url); return send(res, 200, null) }
    if (command === 'execute/sync') return send(res, 200, new Function(json.script)(...json.args))
    if (command === 'execute/async') {
      return new Function(json.script)(...json.args, (value) => send(res, 200, value))
    }
    send(res, 404, { error: 'unknown command', message: command })
  })
}).listen(port, '127.0.0.1')
`

test('the Safari shim runs a page through WebDriver and relays the recorded console', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'threejs-safaridriver-'))
  const driver = join(dir, 'fake-safaridriver.mjs')
  writeFileSync(driver, FAKE_DRIVER)
  const browser = await safari.launch({ executable: process.execPath, driverArgs: [driver], timeout: 20000 })
  const exited = new Promise((resolve) => browser.process().once('exit', resolve))
  try {
    const page = await browser.newPage()
    assert.equal(browser.version(), '26.0')
    const msgs = []
    page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`))
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`))
    await page.goto('http://127.0.0.1:1/parity/page-timeseries.html', { timeout: 5000 })
    assert.equal(await page.waitForFunction(() => true, { timeout: 5000 }), true)
    assert.deepEqual(await page.evaluate(async (a) => ({ doubled: a.n * 2 }), { n: 21 }), { doubled: 42 })
    await assert.rejects(page.evaluate(async () => { throw new Error('render failed') }), /render failed/)
    await page.close()
    assert.deepEqual(msgs, ['[error] boom', '[warning] careful', '[pageerror] uncaught'])

    // Safari takes one session at a time: a closed page frees it for the next.
    const second = await browser.newPage()
    await second.close()
  } finally {
    await browser.close()
    rmSync(dir, { recursive: true, force: true })
  }
  await exited
})

test('a page without the console recorder reports a pageerror instead of zero errors', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'threejs-safaridriver-'))
  const driver = join(dir, 'fake-safaridriver.mjs')
  writeFileSync(driver, FAKE_DRIVER.replace(/globalThis\.window = .*\n/, 'globalThis.window = {}\n'))
  const browser = await safari.launch({ executable: process.execPath, driverArgs: [driver], timeout: 20000 })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.close()
    assert.deepEqual(errors, ['console recorder absent: console output was not observed'])
  } finally {
    await browser.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the console recorder keeps console errors, warnings and uncaught errors', () => {
  const window = new EventTarget()
  const seen = []
  const console = { error: (...a) => seen.push(['error', ...a]), warn: (...a) => seen.push(['warn', ...a]) }
  runInNewContext(CONSOLE_RECORDER, { window, console, JSON, String })
  console.error('bad', { message: 'thing' })
  console.warn('soft')
  const error = new Event('error')
  Object.defineProperty(error, 'message', { value: 'uncaught' })
  window.dispatchEvent(error)
  const rejection = new Event('unhandledrejection')
  Object.defineProperty(rejection, 'reason', { value: new Error('rejected') })
  window.dispatchEvent(rejection)
  // A JSON copy: the entries are objects of the recorder's own realm.
  assert.deepEqual(JSON.parse(JSON.stringify(window.__nm_console)), [
    { type: 'error', text: 'bad thing' },
    { type: 'warning', text: 'soft' },
    { type: 'pageerror', text: 'uncaught' },
    { type: 'pageerror', text: 'rejected' },
  ])
  assert.equal(seen.length, 2, 'the original console methods still run')
})
