import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildStableKit } from '../vendor/build-stable-kit.mjs'
import { bootEngine } from '../vendor/engine.mjs'
import { bootCore, finalizeEnums, registerEffectInstance } from '../src/effects/register-effect.js'

test('the export kit delivers its reviewed stable engine with the engine checkbox', () => {
  const config = JSON.parse(readFileSync(new URL('../export-kit/kit.config.json', import.meta.url)))
  assert.equal(config.engineSource, 'kit')
  assert.ok(config.subtrees.some(tree => tree.from === 'export-kit/engine' && tree.to === 'engine'))
  assert.equal(config.gatedTopLevelDirs.engine, 'engine')
  assert.ok(config.engineBytesFrom.includes('engine/'))
  const template = readFileSync(new URL('../export-kit/kit/index.template.html', import.meta.url), 'utf8')
  assert.ok(template.includes('"./engine/noisemaker-shaders-core.esm.min.js"'))
  assert.ok(template.includes("const BUNDLE_PATH = './engine/effects'"))
})

test('the committed engine is reproducible and altered bundle bytes fail the gate', async () => {
  const built = await buildStableKit({ check: true })
  const metadata = JSON.parse(readFileSync(new URL('../export-kit/engine/deployment-meta.json', import.meta.url)))
  assert.equal(built.source, metadata.git_hash)
  assert.equal(built.stableSourceSha256, metadata.stable_source_sha256)
  const temporary = mkdtempSync(join(tmpdir(), 'stable-kit-test-'))
  const directory = join(temporary, 'engine')
  try {
    cpSync(new URL('../export-kit/engine/', import.meta.url), directory, { recursive: true })
    cpSync(new URL('../export-kit/overlay/', import.meta.url), join(temporary, 'overlay'), { recursive: true })
    writeFileSync(join(directory, 'noisemaker-shaders-core.esm.min.js'), 'export const broken = true\n')
    await assert.rejects(buildStableKit({ destination: directory, check: true }), /Stable kit output differs/)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('the shipped bundle retains stable element ids and excludes experimental surfaces', async () => {
  await bootEngine()
  const core = await import('../export-kit/engine/noisemaker-shaders-core.esm.min.js')
  await bootCore(core)
  const { default: noise } = await import('../export-kit/engine/effects/synth/noise.js')
  const choices = {}
  await registerEffectInstance(core, 'synth', 'noise', noise, choices)
  await finalizeEnums(core, choices)
  const source = 'search synth\nnoise(_id: "generator").write(o0)'
  assert.equal(core.compile(source).plans[0].chain[0].args._id, 'generator')
  assert.ok(core.compileGraph(source).passes.length)
  for (const source of ['noise(1, scaleX: 2).write(o0)', 'scene().write(o0)', 'let node = {x: 1}\nnoise().write(o0)']) {
    assert.throws(() => core.compileGraph('search synth\n' + source))
  }
  assert.ok(!('isScene' in core.CanvasRenderer.prototype))
})

test('generated effect modules retain every published shader byte and descriptor value', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../export-kit/engine/effects/manifest.json', import.meta.url)))
  for (const id of Object.keys(manifest)) {
    const { default: published } = await import(`../vendor/noisemaker/effects/${id}.js?stable-kit-comparison`)
    const { default: shipped } = await import(`../export-kit/engine/effects/${id}.js?stable-kit-comparison`)
    assert.equal(typeof shipped, typeof published, id)
    assert.deepEqual(shipped.shaders, published.shaders, id)
    const descriptor = effect => JSON.parse(JSON.stringify(typeof effect === 'function' ? new effect() : effect))
    assert.deepEqual(descriptor(shipped), descriptor(published), id)
  }
})
