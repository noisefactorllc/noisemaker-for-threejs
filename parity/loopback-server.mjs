// Shared loopback server bind for the qualification drivers.
//
// NM_TS_PORT: sandboxed hosts (the macOS GPU host broker, restricted
// supervisor runners) only permit explicit fixed loopback ports — an
// ephemeral listen(0) fails with EPERM there, and some sandboxes neither
// error nor call back on a bind. Honor the env when set, then fall back
// through the sandbox's loopback range; every attempt is time-bounded so a
// wedged bind falls through instead of hanging the driver. The same
// convention lives in parity/timeseries.mjs (its own harness port) and is
// the pattern parity/probe-live-streams.mjs established.
const FIXED_PORTS = [43117, 43118, 43119, 43120, 43121, 43122, 43123, 43124, 43125, 43126]
const LISTEN_TIMEOUT_MS = 5000

function tryListen (server, port) {
  return new Promise((resolveBind) => {
    let settled = false
    let timer = null
    const settle = (bound) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.removeAllListeners('error')
      if (!bound) server.close()
      resolveBind(bound)
    }
    timer = setTimeout(() => settle(false), LISTEN_TIMEOUT_MS)
    server.once('error', () => settle(false))
    server.listen(port, '127.0.0.1', () => settle(true))
  })
}

// makeServer() builds a fresh http.Server per attempt (an unbound server from
// a failed attempt is closed, but a clean instance keeps the handlers honest).
// Resolves { server, port } for the first successful bind, or throws when the
// whole candidate chain is exhausted.
export async function startLoopbackServer (makeServer) {
  const candidates = process.env.NM_TS_PORT
    ? [Number(process.env.NM_TS_PORT), 0, ...FIXED_PORTS]
    : [0, ...FIXED_PORTS]
  for (const port of candidates) {
    const server = makeServer()
    if (await tryListen(server, port)) return { server, port: server.address().port }
  }
  throw new Error(`no permitted loopback port (tried ${candidates.join(', ')})`)
}
