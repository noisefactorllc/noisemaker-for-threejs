import { test } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'node:http'
import { startLoopbackServer } from '../parity/loopback-server.mjs'

// A stub server whose listen() never calls back and never errors — the
// sandbox pathology the fallback chain exists for (a wedged bind).
function wedgedServer (log) {
  return {
    once () {},
    removeAllListeners () {},
    listen (port, host, callback) {
      log.push(`listen ${port}`)
      // Neither the bind callback nor 'error' ever fires.
      void callback
    },
    close (callback) {
      log.push('close')
      // A close on a server that never bound reports the failure through its
      // callback (real net.Server) — the helper must hand it a no-op.
      if (callback) callback(new Error('ERR_SERVER_NOT_RUNNING'))
    },
    address () { return { port: 0 } },
  }
}

test('binds on the ephemeral port by default', async () => {
  const { server, port } = await startLoopbackServer(() => createServer(() => {}))
  assert.ok(Number.isInteger(port) && port > 0, `ephemeral port: ${port}`)
  await new Promise((resolve) => server.close(resolve))
})

test('honors NM_TS_PORT as the first candidate', async () => {
  const previous = process.env.NM_TS_PORT
  process.env.NM_TS_PORT = '43125'
  try {
    const { server, port } = await startLoopbackServer(() => createServer(() => {}))
    assert.equal(port, 43125)
    await new Promise((resolve) => server.close(resolve))
  } finally {
    if (previous === undefined) delete process.env.NM_TS_PORT
    else process.env.NM_TS_PORT = previous
  }
})

test('a refused bind falls through to the next candidate', async () => {
  const refused = {
    once (event, handler) { this.errorHandler = event === 'error' ? handler : this.errorHandler },
    removeAllListeners () {},
    listen (port, host, callback) {
      // The sandbox pathology for explicit fixed ports: EPERM surfaces as an
      // 'error' event, not as a thrown exception and not as silence.
      setImmediate(() => this.errorHandler(new Error('listen EPERM')))
      void port; void host; void callback
    },
    close (callback) { if (callback) callback() },
    address () { return { port: 0 } },
  }
  let firstAttempt = true
  const { server, port } = await startLoopbackServer(() => {
    if (firstAttempt) { firstAttempt = false; return refused }
    return createServer(() => {})
  })
  assert.ok(port > 0)
  await new Promise((resolve) => server.close(resolve))
})

test('a wedged bind times out, is torn down, and falls through', async () => {
  const log = []
  const made = []
  const { server, port } = await startLoopbackServer(() => {
    if (made.length === 0) { const s = wedgedServer(log); made.push(s); return s }
    return createServer(() => {})
  }, { timeoutMs: 60 })
  assert.ok(port > 0)
  assert.deepEqual(log, ['listen 0', 'close'],
    'the wedged server must be closed through the hardened teardown path')
  assert.equal(made.length, 1)
  await new Promise((resolve) => server.close(resolve))
})

test('an exhausted candidate chain rejects with the tried ports', async () => {
  const log = []
  await assert.rejects(
    startLoopbackServer(() => wedgedServer(log), { timeoutMs: 30 }),
    (error) => {
      assert.match(error.message, /^no permitted loopback port \(tried /)
      assert.match(error.message, /0, 43117/)
      return true
    },
  )
  assert.equal(log.filter((entry) => entry === 'close').length, 11,
    'every attempted server is torn down')
})
