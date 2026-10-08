import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { bootEngine } from '../vendor/engine.mjs'

// Every corpus fixture must compile with the REFERENCE engine, so the corpus gate compares
// renders instead of excusing compile failures. A shared program that calls user.* effects
// carries their published Portable definitions in a <code>.effects.json sidecar; this test
// registers them through the reference engine's own CanvasRenderer.registerPortableEffect (the
// path the apps use for a shared program) and compiles the DSL. Skips cleanly when the engine
// isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const corpusDir = fileURLToPath(new URL('../parity/corpus/', import.meta.url))
const fixtures = readdirSync(corpusDir).filter((f) => f.endsWith('.dsl')).sort().map((f) => basename(f, '.dsl'))

function sidecar (name) {
  const path = join(corpusDir, `${name}.effects.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

test('the corpus keeps its 88 fixtures', () => {
  assert.equal(fixtures.length, 88)
})

test('every effects sidecar belongs to a fixture and holds published user effects', () => {
  for (const file of readdirSync(corpusDir).filter((f) => f.endsWith('.effects.json'))) {
    const name = file.replace(/\.effects\.json$/, '')
    assert.ok(fixtures.includes(name), `${file} has no ${name}.dsl`)
    const data = sidecar(name)
    assert.match(data.source, /^https:\/\/sharing\.noisedeck\.app\/api\/composition\/[A-Za-z0-9_-]+$/, `${file} source`)
    assert.ok(Array.isArray(data.effects) && data.effects.length > 0, `${file} effects`)
    for (const effect of data.effects) assert.equal(effect.namespace, 'user', `${file} ${effect.name} namespace`)
  }
})

test('every corpus fixture compiles with the reference engine', { skip }, async () => {
  const { core, compileGraph } = await bootEngine()
  const reference = new core.CanvasRenderer({})
  const registered = new Map()
  const failures = []
  for (const name of fixtures) {
    try {
      for (const effect of sidecar(name)?.effects || []) {
        const func = effect.func ?? effect.name
        if (registered.has(func)) {
          // The registry is realm-global: one definition per user effect name.
          assert.ok(isDeepStrictEqual(registered.get(func), effect), `${name}: conflicting user.${func} definition`)
          continue
        }
        await reference.registerPortableEffect(effect)
        registered.set(func, effect)
      }
      const graph = compileGraph(readFileSync(join(corpusDir, `${name}.dsl`), 'utf8'))
      assert.ok(Array.isArray(graph.passes) && graph.passes.length > 0, `${name}: no passes`)
    } catch (error) {
      const first = error?.diagnostics?.[0]
      failures.push(`${name}: ${first ? `${first.code} ${first.message}` : String(error?.message || error).slice(0, 160)}`)
    }
  }
  assert.deepEqual(failures, [], `${failures.length} corpus fixtures fail to compile with the reference engine`)
})
