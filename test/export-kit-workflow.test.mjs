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

test('the Safari leg enables safaridriver on hosted macOS and renders through NM_BROWSER=safari', () => {
  const safariJobs = Object.entries(jobs()).filter(([, body]) => body.some((line) => /NM_BROWSER:\s*safari/.test(line)))
  assert.deepEqual(safariJobs.map(([name]) => name), ['parity-safari'])
  const body = safariJobs[0][1]
  assert.deepEqual(runnersOf(body).map((runner) => runner.split('-')[0]), ['macos'])
  assert.ok(body.some((line) => line.includes('sudo /usr/bin/safaridriver --enable')), 'Safari automation must be enabled on the runner')
  assert.ok(body.some((line) => line.includes('scripts/parity-summary noise')), 'the Safari leg must render a sweep case')
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


// The steps of a job body (from jobs()): each `      - ` line with the lines
// indented under it.
function stepsOf (body) {
  const steps = []
  for (const line of body) {
    if (line.startsWith('      - ')) steps.push([line])
    else if (steps.length && line.startsWith('        ')) steps[steps.length - 1].push(line)
  }
  return steps.map((step) => step.join('\n'))
}

// These checks guard against accidental regressions (a deleted gate, a soft
// fail, a dropped argument). They do not pin the job's text, so a reviewed
// edit such as an action pin bump still passes.
test('the live-input sweep and the live-stream probe gate the Linux and macOS parity job', () => {
  const body = jobs().parity
  assert.ok(body, 'no parity job')
  assert.ok(!body.some((line) => line.includes('continue-on-error')), 'neither the parity job nor a step may soft-fail')
  const steps = stepsOf(body)
  for (const [script, log] of [['parity/sweep-live-inputs.mjs', 'live-inputs'], ['parity/probe-live-streams.mjs', 'live-streams']]) {
    assert.deepEqual(platformsRunning(script), ['macos', 'ubuntu'], script)
    const gate = steps.filter((step) => step.includes(script))
    assert.equal(gate.length, 1, `${script} runs once in the parity job`)
    assert.match(gate[0], new RegExp(`\\n {8}run: bash scripts/gate-step\\.sh parity/out/${log}\\.log node ${script.replace('.', '\\.')}`))
    assert.doesNotMatch(gate[0], /\|\|\s*true/, `${script} must not ignore its exit status`)
  }
})

test('the kit dispatch waits for the parity job', () => {
  const needs = /needs:\s*\[([^\]]+)\]/.exec(jobs().dispatch.join('\n'))
  assert.ok(needs, 'dispatch has no needs list')
  assert.ok(needs[1].split(',').map((name) => name.trim()).includes('parity'), 'dispatch must need parity')
})
