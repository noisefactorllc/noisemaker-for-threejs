// Real Safari for the parity harness, driven through Safari's built-in
// WebDriver (safaridriver) behind the small Playwright-shaped surface that
// parity/timeseries.mjs uses: browserType.launch() -> browser;
// browser.newPage(), version(), process(), close(); page.on(), goto(),
// waitForFunction(), evaluate(), close().
//
// Playwright's WebKit build is not Safari, so this drives the installed Safari
// itself. Safari accepts one WebDriver session at a time: every page is its own
// session, so the golden and candidate modes each get a fresh browser realm, as
// Playwright pages do. WebDriver has no console channel. CONSOLE_RECORDER (the
// harness injects it into the served page) keeps console errors, warnings and
// uncaught errors in the page; page.close() relays them to the 'console' and
// 'pageerror' listeners before it ends the session. A page without the
// recorder reports one pageerror, so absent console evidence never reads as
// zero errors.
//
// A host enables Safari automation once with `sudo safaridriver --enable`.
// NM_SAFARIDRIVER overrides the driver binary (default /usr/bin/safaridriver).
import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { startLoopbackServer } from './loopback-server.mjs'

export const CONSOLE_RECORDER = `(() => {
  const log = window.__nm_console = []
  const text = (args) => args.map((a) => {
    try { return typeof a === 'string' ? a : (a && a.message) || JSON.stringify(a) } catch { return String(a) }
  }).join(' ').slice(0, 500)
  for (const [method, type] of [['error', 'error'], ['warn', 'warning']]) {
    const original = console[method].bind(console)
    console[method] = (...args) => { log.push({ type, text: text(args) }); original(...args) }
  }
  window.addEventListener('error', (event) => {
    const target = event.target
    const resource = target && target !== window && (target.src || target.href)
    log.push({ type: resource ? 'error' : 'pageerror', text: String(resource ? 'failed to load ' + resource : (event.message || event.error || 'page error')).slice(0, 500) })
  }, true)
  window.addEventListener('unhandledrejection', (event) => {
    log.push({ type: 'pageerror', text: String((event.reason && event.reason.message) || event.reason || 'unhandled rejection').slice(0, 500) })
  })
})()`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The harness watchdog (NM_TS_TIMEOUT_MS) stays authoritative: the WebDriver
// script timeout and the HTTP bound sit above it.
function scriptTimeoutMs () {
  return Number(process.env.NM_TS_TIMEOUT_MS || 1200000) + 60000
}

// One WebDriver command. node:http, not fetch: fetch's default header timeout
// (300 s) would cut off a long render, so every call carries its own bound.
export function webdriverCommand (port, method, path, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
    const headers = payload ? { 'content-type': 'application/json; charset=utf-8', 'content-length': payload.length } : {}
    const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        clearTimeout(timer)
        let parsed
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          reject(new Error(`safaridriver ${method} ${path}: invalid JSON (HTTP ${res.statusCode})`))
          return
        }
        const value = parsed?.value
        if (res.statusCode >= 400 || (value && typeof value === 'object' && value.error)) {
          reject(new Error(`safaridriver ${method} ${path}: HTTP ${res.statusCode} ${value?.error || ''} ${value?.message || ''}`.trim()))
          return
        }
        resolve(value)
      })
      res.on('error', (error) => { clearTimeout(timer); reject(error) })
    })
    const timer = setTimeout(() => req.destroy(new Error(`safaridriver ${method} ${path}: no response after ${timeoutMs}ms`)), timeoutMs)
    req.on('error', (error) => { clearTimeout(timer); reject(error) })
    if (payload) req.write(payload)
    req.end()
  })
}

async function freePort () {
  const { server, port } = await startLoopbackServer(() => createServer())
  await new Promise((resolve) => server.close(resolve))
  return port
}

class SafariPage {
  constructor (browser, sessionId) {
    this.browser = browser
    this.sessionId = sessionId
    this.listeners = { console: [], pageerror: [] }
    this.closed = false
  }

  on (event, listener) {
    if (this.listeners[event]) this.listeners[event].push(listener)
    return this
  }

  emit (event, payload) {
    for (const listener of this.listeners[event]) listener(payload)
  }

  command (method, suffix, body, timeoutMs) {
    return webdriverCommand(this.browser.port, method, `/session/${this.sessionId}${suffix}`, body, timeoutMs)
  }

  async goto (url, { timeout = 60000 } = {}) {
    await this.command('POST', '/timeouts', { pageLoad: timeout, script: scriptTimeoutMs() }, 30000)
    await this.command('POST', '/url', { url }, timeout + 10000)
  }

  async waitForFunction (fn, { timeout = 30000 } = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
      if (await this.command('POST', '/execute/sync', { script: `return Boolean((${fn}).call(null))`, args: [] }, 30000)) return true
      if (Date.now() > deadline) throw new Error(`waitForFunction timed out after ${timeout}ms`)
      await sleep(100)
    }
  }

  async evaluate (fn, arg) {
    const script = [
      'const done = arguments[arguments.length - 1]',
      `Promise.resolve().then(() => (${fn})(arguments[0])).then(`,
      '  (value) => done({ ok: true, value }),',
      '  (error) => done({ ok: false, error: String((error && error.message) || error) }))',
    ].join('\n')
    const result = await this.command('POST', '/execute/async', { script, args: [arg === undefined ? null : arg] }, scriptTimeoutMs() + 60000)
    if (!result || result.ok !== true) throw new Error(result?.error || 'evaluate returned no result')
    return result.value
  }

  async close () {
    if (this.closed) return
    this.closed = true
    this.browser.pages.delete(this)
    try {
      const log = await this.command('POST', '/execute/sync', { script: 'return window.__nm_console || null', args: [] }, 10000)
      if (!Array.isArray(log)) {
        this.emit('pageerror', { message: 'console recorder absent: console output was not observed' })
      } else {
        for (const entry of log) {
          if (entry.type === 'pageerror') this.emit('pageerror', { message: entry.text })
          else this.emit('console', { type: () => entry.type, text: () => entry.text })
        }
      }
    } catch (error) {
      this.emit('pageerror', { message: `console readback failed: ${error.message}` })
    }
    await this.command('DELETE', '', undefined, 30000).catch(() => {})
  }
}

class SafariBrowser {
  constructor (port, child) {
    this.port = port
    this.child = child
    this.pages = new Set()
    this.browserVersion = ''
  }

  async newPage () {
    const value = await webdriverCommand(this.port, 'POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } }, 120000)
    if (!value?.sessionId) throw new Error('safaridriver created no session')
    this.browserVersion = value.capabilities?.browserVersion || ''
    const page = new SafariPage(this, value.sessionId)
    this.pages.add(page)
    return page
  }

  version () {
    return this.browserVersion
  }

  process () {
    return this.child
  }

  async close () {
    for (const page of [...this.pages]) await page.close().catch(() => {})
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGTERM')
  }
}

export const safari = {
  name: () => 'safari',
  // driverArgs precede --port (tests run a stand-in driver through node).
  async launch ({ timeout = 120000, executable = process.env.NM_SAFARIDRIVER || '/usr/bin/safaridriver', driverArgs = [] } = {}) {
    const port = await freePort()
    const child = spawn(executable, [...driverArgs, '--port', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let spawnError = null
    child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-2000) })
    child.once('error', (error) => { spawnError = error })
    const deadline = Date.now() + timeout
    for (;;) {
      if (spawnError) throw new Error(`safaridriver failed to start: ${spawnError.message}`)
      if (child.exitCode !== null) throw new Error(`safaridriver exited with ${child.exitCode}: ${stderr.trim()}`)
      try {
        await webdriverCommand(port, 'GET', '/status', undefined, 5000)
        return new SafariBrowser(port, child)
      } catch { /* not listening yet */ }
      if (Date.now() > deadline) {
        child.kill('SIGKILL')
        throw new Error(`safaridriver did not answer on port ${port} within ${timeout}ms: ${stderr.trim()}`)
      }
      await sleep(250)
    }
  },
}
