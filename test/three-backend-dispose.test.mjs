import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'

globalThis.HTMLElement = globalThis.HTMLElement || class {}
globalThis.customElements = globalThis.customElements || {
  define() {},
  get() {},
  whenDefined() { return Promise.resolve() },
}
globalThis.window = globalThis.window || globalThis
globalThis.document = globalThis.document || {
  createElement() { return { style: {}, getContext() { return null }, appendChild() {}, setAttribute() {} } },
  createElementNS() { return { style: {} } },
  head: { appendChild() {} },
  body: { appendChild() {} },
}

const { ThreeBackend } = await import('../src/backend/three-backend.js')

// Minimal mock renderer: ThreeBackend only touches the GL context directly for the
// raw-GL paths under test here (mesh depth attachment, source uploads). No rendering.
function makeMockRenderer() {
  const renderbuffers = []
  const deletedRenderbuffers = []
  const glTextures = []
  const deletedTextures = []
  const propsMap = new WeakMap()

  const gl = {
    FRAMEBUFFER: 0x8d40,
    RENDERBUFFER: 0x8d41,
    DEPTH_ATTACHMENT: 0x8d00,
    DEPTH_COMPONENT24: 0x81fa,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    createRenderbuffer() {
      const rb = { id: renderbuffers.length + 1 }
      renderbuffers.push(rb)
      return rb
    },
    deleteRenderbuffer(rb) { deletedRenderbuffers.push(rb) },
    bindFramebuffer() {},
    bindRenderbuffer() {},
    renderbufferStorage() {},
    framebufferRenderbuffer() {},
    createTexture() {
      const tex = { id: glTextures.length + 1 }
      glTextures.push(tex)
      return tex
    },
    deleteTexture(tex) { deletedTextures.push(tex) },
    bindTexture() {},
    texParameteri() {},
    pixelStorei() {},
    texImage2D() {},
  }

  const renderer = {
    getContext() { return gl },
    properties: {
      get(obj) {
        if (!propsMap.has(obj)) propsMap.set(obj, {})
        return propsMap.get(obj)
      },
    },
    resetState() {},
    getRenderTarget() { return null },
    setRenderTarget() {},
    setClearColor() {},
    clear() {},
    render() {},
  }

  return { renderer, gl, renderbuffers, deletedRenderbuffers, glTextures, deletedTextures }
}

// An owned render target + texture-info record, as createTexture would leave them.
function seedOwnedTexture(backend, id, width = 4, height = 4) {
  const rt = new THREE.WebGLRenderTarget(width, height)
  let disposed = false
  rt.addEventListener('dispose', () => { disposed = true })
  backend.textures.set(id, { target: rt, texture: rt.texture, width, height, format: 'rgba32f' })
  return { rt, disposed: () => disposed }
}

test('destroyTexture releases the mesh-depth renderbuffer attached to its target', () => {
  const { renderer, renderbuffers, deletedRenderbuffers } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)
  const { rt } = seedOwnedTexture(backend, 'mesh_out')
  renderer.properties.get(rt).__webglFramebuffer = {}

  backend.ensureMeshDepth(rt)
  assert.equal(renderbuffers.length, 1)

  // The pipeline destroys + recreates surface textures on every resize; the old
  // target's DEPTH_COMPONENT24 renderbuffer must go with it.
  backend.destroyTexture('mesh_out')
  assert.ok(deletedRenderbuffers.includes(renderbuffers[0]))

  // A replacement target gets its own renderbuffer (no stale reuse).
  const replacement = seedOwnedTexture(backend, 'mesh_out', 8, 8)
  renderer.properties.get(replacement.rt).__webglFramebuffer = {}
  backend.ensureMeshDepth(replacement.rt)
  assert.equal(renderbuffers.length, 2)
})

test('destroy() releases depth renderbuffers not reclaimed per-texture', () => {
  const { renderer, renderbuffers, deletedRenderbuffers } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)
  const { rt } = seedOwnedTexture(backend, 'mesh_out')
  renderer.properties.get(rt).__webglFramebuffer = {}
  backend.ensureMeshDepth(rt)

  backend.destroy()
  assert.ok(deletedRenderbuffers.includes(renderbuffers[0]))
})

test('uploadDataTexture releases a replaced owned render target', () => {
  const { renderer } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)
  const { disposed } = seedOwnedTexture(backend, 'grid')

  backend.uploadDataTexture('grid', new Float32Array(8), 2, 2)
  assert.ok(disposed(), 'the owned render target was disposed')
  assert.ok(backend.textures.get('grid')?.dataTexture)
})

test('updateTextureFromSource releases a replaced owned render target', () => {
  const { renderer } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)
  const { disposed } = seedOwnedTexture(backend, 'src')

  const dim = backend.updateTextureFromSource('src', { width: 4, height: 4 })
  assert.deepEqual(dim, { width: 4, height: 4 })
  assert.ok(disposed(), 'the owned render target was disposed')
  assert.ok(backend.textures.get('src')?.externalGL)
})

test('getMRTHost releases the previous host when the surface size changes', () => {
  const { renderer } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)

  const first = backend.getMRTHost(2, 4, 4)
  let disposed = false
  first.addEventListener('dispose', () => { disposed = true })

  const second = backend.getMRTHost(2, 8, 8)
  assert.notEqual(second, first)
  assert.ok(disposed, 'the out-of-size host was disposed')

  // Same size and attachment count -> the host is reused.
  assert.equal(backend.getMRTHost(2, 8, 8), second)
})

test('destroy() disposes MRT hosts, cached draw geometries, and depth renderbuffers', () => {
  const { renderer, renderbuffers, deletedRenderbuffers } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)

  const host = backend.getMRTHost(2, 4, 4)
  let hostDisposed = false
  host.addEventListener('dispose', () => { hostDisposed = true })

  // Drive the point-geometry cache through the public draw path (renderer mocked).
  const pass = (count) => ({ id: 'p', program: 'prog', drawMode: 'points', count, outputs: { color: 'o0' } })
  backend.programs.set('prog', { material: new THREE.RawShaderMaterial(), spec: {}, uniformSizes: {} })
  backend.executePoints(pass(3), { surfaces: {} })
  backend.executePoints(pass(5), { surfaces: {} })
  assert.equal(backend._pointGeoCache.size, 2)
  const geos = [...backend._pointGeoCache.values()]
  const geoDisposed = geos.map((geo) => {
    let hit = false
    geo.addEventListener('dispose', () => { hit = true })
    return () => hit
  })

  const { rt } = seedOwnedTexture(backend, 'mesh_out')
  renderer.properties.get(rt).__webglFramebuffer = {}
  backend.ensureMeshDepth(rt)

  backend.destroy()
  assert.ok(hostDisposed, 'MRT host was disposed')
  assert.ok(geoDisposed.every((f) => f()), 'cached point geometries were disposed')
  assert.ok(deletedRenderbuffers.includes(renderbuffers.at(-1)), 'depth renderbuffer was deleted')
  assert.equal(backend._pointGeoCache.size, 0)
})
