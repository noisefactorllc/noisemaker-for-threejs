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


// The block of a job: its header and its indented lines, up to the next job
// or the next two-space comment, without trailing blank lines.
function block (name) {
  const lines = text.split('\n')
  const start = lines.indexOf(`  ${name}:`)
  assert.ok(start >= 0, `no ${name} job`)
  const out = [lines[start]]
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break
    out.push(line)
  }
  while (out.length && !out[out.length - 1].trim()) out.pop()
  return out.join('\n')
}

// The reviewed Linux and macOS parity job, live-input and live-stream gates
// included. Any change to its triggers, matrix, shell, steps, conditions or
// commands needs a reviewed change here.
const PARITY_JOB = [
  "  parity:",
  "    if: github.ref == 'refs/heads/main' && github.event_name != 'push'",
  "    permissions:",
  "      contents: read",
  "    strategy:",
  "      fail-fast: false",
  "      matrix:",
  "        os: [ubuntu-24.04, macos-15]",
  "    runs-on: ${{ matrix.os }}",
  "    timeout-minutes: 150",
  "    defaults:",
  "      run:",
  "        shell: bash",
  "    steps:",
  "      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1",
  "      - uses: ./.github/actions/parity-setup",
  "        with:",
  "          artifact-suffix: ${{ matrix.os }}",
  "      - name: Programs gate",
  "        run: bash scripts/gate-step.sh parity/out/programs.log node parity/sweep-programs.mjs",
  "      - name: Stateful gate",
  "        if: ${{ !cancelled() }}",
  "        run: bash parity/sweep-stateful.sh 2>&1 | tee parity/out/stateful.log",
  "      - name: Corpus gate",
  "        if: ${{ !cancelled() }}",
  "        run: npm run parity 2>&1 | tee parity/out/corpus.log",
  "      # The browser's own decoders (fixed PNG, WebM and WAV bytes) feed media,",
  "      # scope and spectrum on both backends, graded at tolerance 0.",
  "      - name: Live-input gate",
  "        if: ${{ !cancelled() }}",
  "        run: bash scripts/gate-step.sh parity/out/live-inputs.log node parity/sweep-live-inputs.mjs",
  "      # getUserMedia camera and microphone streams from Chromium's fake devices",
  "      # reach the shaders on both backends.",
  "      - name: Live-stream gate",
  "        if: ${{ !cancelled() }}",
  "        run: bash scripts/gate-step.sh parity/out/live-streams.log node parity/probe-live-streams.mjs",
  "      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1",
  "        if: always()",
  "        with:",
  "          name: rendered-parity-${{ matrix.os }}-${{ github.sha }}",
  "          path: parity/out/",
  "          if-no-files-found: error"
].join('\n')

// The reviewed workflow triggers.
const ON_BLOCK = [
  "  workflow_dispatch:",
  "  schedule:",
  "    - cron: '13 8 * * 1'",
  "  push:",
  "    branches: [main]",
  "    paths:",
  "      - \"export-kit/**\"",
  "      - \".github/workflows/export-kit.yml\"",
  "      # LICENSE is shipped kit content (vendored into LICENSES/): a relicense must auto-publish.",
  "      - \"LICENSE\"",
  "      - \"src/**\"",
  "      - \"package-lock.json\"",
  "      - \"package.json\"",
  "      - \"parity/**\"",
  "      - \"test/**\"",
  "      - \"vendor/fetch.sh\"",
  "      - \".github/actions/**\""
].join('\n')

test('the Linux and macOS parity job is exactly the reviewed job', () => {
  assert.equal(block('parity'), PARITY_JOB)
  assert.equal(text.split('\n').filter((line) => line === '  parity:').length, 1, 'one parity job')
})

test('the kit dispatch waits for the parity job and runs only after every need succeeded', () => {
  const dispatch = block('dispatch').split('\n')
  const needs = /^ {4}needs: \[([^\]]+)\]$/.exec(dispatch[1])
  assert.ok(needs, `dispatch needs: ${dispatch[1]}`)
  assert.ok(needs[1].split(',').map((name) => name.trim()).includes('parity'), 'dispatch must need parity')
  assert.equal(dispatch[2], "    if: github.ref == 'refs/heads/main' && github.event_name != 'push'")
})

test('no top-level default changes a job shell', () => {
  assert.doesNotMatch(text, /^["']?defaults["']?\s*:/m)
})

test('the workflow runs on the reviewed triggers', () => {
  const lines = text.split('\n')
  const start = lines.indexOf('on:')
  const on = []
  for (const line of lines.slice(start + 1)) {
    if (/^[^ #]/.test(line)) break
    on.push(line)
  }
  while (on.length && !on[on.length - 1].trim()) on.pop()
  assert.equal(on.join('\n'), ON_BLOCK)
})
