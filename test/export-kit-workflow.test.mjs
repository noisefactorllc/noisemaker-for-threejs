import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

// The export-kit workflow must run the installed-package and served-kit consumer gates on every
// platform the parity matrix covers (Linux, macOS, Windows), and the kit dispatch must wait for
// every installed-package gate. Reads the YAML text: the repository has no YAML parser.
const text = readFileSync(new URL('../.github/workflows/export-kit.yml', import.meta.url), 'utf8')

function jobs () {
  const lines = text.split('\n')
  const start = lines.indexOf('jobs:')
  const out = {}
  let name = null
  for (const line of lines.slice(start + 1)) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)
    if (m) { name = m[1]; out[name] = []; continue }
    if (name && line.trim()) out[name].push(line)
  }
  return out
}

function runnersOf (body) {
  const joined = body.join('\n')
  const matrix = /matrix:\s*\n\s*os:\s*\[([^\]]+)\]/.exec(joined)
  if (matrix && /runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/.test(joined)) return matrix[1].split(',').map((s) => s.trim())
  const fixed = /runs-on:\s*([^\s#]+)/.exec(joined)
  return fixed ? [fixed[1]] : []
}

function platformsRunning (script) {
  const platforms = new Set()
  for (const body of Object.values(jobs())) {
    if (!body.some((line) => line.includes(script))) continue
    for (const runner of runnersOf(body)) platforms.add(runner.split('-')[0])
  }
  return [...platforms].sort()
}

test('the installed-package consumer gate runs on Linux, macOS and Windows', () => {
  assert.deepEqual(platformsRunning('parity/installed-consumer.mjs'), ['macos', 'ubuntu', 'windows'])
})

test('the served-kit consumer gate runs on Linux, macOS and Windows', () => {
  assert.deepEqual(platformsRunning('parity/kit-consumer.mjs'), ['macos', 'ubuntu', 'windows'])
})

test('the kit dispatch waits for every installed-package consumer gate', () => {
  const all = jobs()
  const needs = /needs:\s*\[([^\]]+)\]/.exec(all.dispatch.join('\n'))[1].split(',').map((s) => s.trim())
  const consumerJobs = Object.entries(all)
    .filter(([, body]) => body.some((line) => line.includes('parity/installed-consumer.mjs')))
    .map(([name]) => name)
  assert.ok(consumerJobs.length >= 2, `consumer jobs: ${consumerJobs}`)
  for (const name of consumerJobs) assert.ok(needs.includes(name), `dispatch must need ${name}`)
})
