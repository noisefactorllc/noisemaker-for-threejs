import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { bootEngine } from '../vendor/engine.mjs'
import { applyPatch } from '../vendor/build-stable-core.mjs'
import { bootCore, registerEffectInstance, finalizeEnums } from '../src/effects/register-effect.js'

const { core: candidate, compileGraph } = await bootEngine()
const reference = await import('../vendor/noisemaker/noisemaker-shaders-reference.esm.js')
const manifest = JSON.parse(readFileSync(new URL('../vendor/noisemaker/effects/manifest.json', import.meta.url)))
await bootCore(reference)
const choices = {}
for (const id of Object.keys(manifest)) {
  const [namespace, name] = id.split('/')
  const { default: instance } = await import(new URL(`../vendor/noisemaker/effects/${id}.js`, import.meta.url))
  await registerEffectInstance(reference, namespace, name, instance, choices)
}
await finalizeEnums(reference, choices)

const canonicalGraph = graph => {
  const { compiledAt, _isScene, sceneIR, sceneVolumeAtlasScopes, ...stable } = graph
  assert.ok(compiledAt > 0)
  if (_isScene !== undefined) assert.equal(_isScene, false)
  if (sceneIR !== undefined) assert.equal(sceneIR, null)
  if (sceneVolumeAtlasScopes !== undefined) assert.deepEqual(sceneVolumeAtlasScopes, {})
  const values = value => {
    if (typeof value === 'function') return { functionSource: value.toString() }
    if (value instanceof Map) return { mapEntries: [...value].map(values) }
    if (Array.isArray(value)) return value.map(values)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, values(child)]))
    return value
  }
  return values(stable)
}

test('stable fixture graphs agree with the independent published compiler', () => {
  const directory = new URL('../parity/programs/', import.meta.url)
  const retired = new Set(['bc.dsl', 'hs.dsl', 'colorspace.dsl'])
  for (const name of readdirSync(directory).filter(name => name.endsWith('.dsl') && !retired.has(name))) {
    const source = readFileSync(new URL(name, directory), 'utf8')
    assert.deepEqual(canonicalGraph(compileGraph(source)), canonicalGraph(reference.compileGraph(source)), name)
  }
})

test('stable derivation preserves shared geometry and excludes experimental modules', async () => {
  const { SURFACE } = await import('../vendor/noisemaker/stability.mjs')
  const inputs = JSON.parse(readFileSync(new URL('../vendor/noisemaker/stable-source-inputs.json', import.meta.url)))
  for (const path of Object.keys(SURFACE.modules)) assert.ok(!inputs.inputs[`shaders/src/${path}`], path)
  assert.ok(inputs.inputs['shaders/src/geometry/geometry.js'])
  for (const [path, record] of Object.entries(inputs.inputs)) {
    const bytes = readFileSync(new URL(`../vendor/noisemaker/stable-source/${path}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.outputSha256, path)
  }
  const { Geometry } = await import('../vendor/noisemaker/stable-source/shaders/src/geometry/geometry.js')
  const geometry = new Geometry({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([2, 0, 1]),
  })
  const packed = geometry.toPackedTextures(2, 2)
  assert.deepEqual(Array.from(packed.positionData), [0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0])
})

test('experimental grammar exists in the reference but is absent from the stable compiler', () => {
  const source = 'search synth\nnoise(1, scaleX: 2).write(o0)'
  assert.doesNotThrow(() => reference.compileGraph(source))
  assert.throws(() => compileGraph(source), /Cannot mix positional and keyword/)
  assert.ok('isScene' in reference.CanvasRenderer.prototype)
  assert.ok(!('isScene' in candidate.CanvasRenderer.prototype))
})

test('array bindings unparse with the published precision and literal forms', () => {
  const source = 'search synth\nlet values = [0.123456789012345, 1 / 7, #804020, true]\nnoise().write(o0)'
  assert.equal(candidate.unparse(candidate.compile(source)), reference.unparse(reference.compile(source)))
})

test('depth attachment preserves the framebuffer selected by its caller', () => {
  const probe = Backend => {
    const target = { name: 'draw-target' }
    let bound = target
    const gl = {
      FRAMEBUFFER: 1, FRAMEBUFFER_BINDING: 2, FRAMEBUFFER_COMPLETE: 3,
      RENDERBUFFER: 4, DEPTH_COMPONENT24: 5, DEPTH_ATTACHMENT: 6,
      getParameter: () => bound, createRenderbuffer: () => ({}),
      bindRenderbuffer() {}, renderbufferStorage() {}, framebufferRenderbuffer() {},
      checkFramebufferStatus: () => 3,
      bindFramebuffer: (_, value) => { bound = value },
    }
    Backend.prototype.ensureDepthBuffer.call({ gl, depthBuffers: new Map() }, target, 8, 8)
    return bound === target
  }
  assert.equal(probe(reference.WebGL2Backend), true)
  assert.equal(probe(candidate.WebGL2Backend), true)
})

test('single-channel readback expands and flips rows like the published backend', () => {
  const probe = (Backend, float) => {
    const calls = []
    const gl = {
      FRAMEBUFFER: 1, FRAMEBUFFER_COMPLETE: 2, COLOR_ATTACHMENT0: 3, TEXTURE_2D: 4,
      RED: 5, RGBA: 6, FLOAT: 7, HALF_FLOAT: 8, UNSIGNED_BYTE: 9,
      createFramebuffer: () => ({}), bindFramebuffer() {}, framebufferTexture2D() {}, deleteFramebuffer() {},
      checkFramebufferStatus: () => 2,
      readPixels: (x, y, w, h, format, type, buffer) => {
        calls.push({ format, type, length: buffer.length })
        buffer.set(float ? [0.5, 1] : [128, 255])
      },
    }
    const textures = new Map([['depth', { handle: {}, width: 1, height: 2, glFormat: { format: gl.RED, type: float ? gl.FLOAT : gl.UNSIGNED_BYTE } }]])
    return { calls, pixels: Array.from(Backend.prototype.readPixels.call({ gl, textures }, 'depth').data) }
  }
  for (const float of [false, true]) {
    const expected = probe(reference.WebGL2Backend, float)
    assert.deepEqual(expected.pixels, [255, 255, 255, 255, 128, 128, 128, 255])
    assert.deepEqual(probe(candidate.WebGL2Backend, float), expected)
  }
})

test('stable-source patches fail on changed context or incorrect lengths', () => {
  const patch = '--- a/x\n+++ b/x\n@@ -1,3 +1,3 @@\n a\n-b\n+c\n \n'
  assert.equal(applyPatch('a\nb\n\n', patch), 'a\nc\n\n')
  assert.throws(() => applyPatch('a\nx\n\n', patch), /context mismatch/)
  assert.throws(() => applyPatch('a\nb\n\n', patch.replace('+1,3', '+1,4')), /length mismatch/)
})
