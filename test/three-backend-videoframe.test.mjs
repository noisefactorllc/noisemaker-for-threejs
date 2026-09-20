import assert from 'node:assert/strict'
import test from 'node:test'

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

class MockVideoFrame {
  constructor({ displayWidth, displayHeight, visibleRect, rotation = 0 }) {
    this.displayWidth = displayWidth
    this.displayHeight = displayHeight
    this.visibleRect = visibleRect || { width: displayWidth, height: displayHeight, x: 0, y: 0 }
    this.rotation = rotation
  }
}

function makeMockRenderer() {
  const glTextures = []
  const deletedTextures = []
  const calls = []
  let nextTexId = 100

  const gl = {
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    createTexture() {
      const tex = { id: ++nextTexId }
      glTextures.push(tex)
      return tex
    },
    deleteTexture(tex) {
      deletedTextures.push(tex)
    },
    bindTexture(target, tex) {
      calls.push(['bindTexture', target, tex])
    },
    texParameteri(target, pname, param) {
      calls.push(['texParameteri', target, pname, param])
    },
    pixelStorei(pname, param) {
      calls.push(['pixelStorei', pname, param])
    },
    texImage2D(...args) {
      calls.push(['texImage2D', ...args])
    },
  }

  const propsMap = new WeakMap()
  const renderer = {
    getContext() { return gl },
    properties: {
      get(obj) {
        if (!propsMap.has(obj)) propsMap.set(obj, {})
        return propsMap.get(obj)
      },
    },
    resetState() {
      calls.push(['resetState'])
    },
  }

  return { renderer, gl, glTextures, deletedTextures, calls }
}

test('ThreeBackend.updateTextureFromSource supports borrowed VideoFrame and validates dimensions', async (t) => {
  const prevVideoFrame = globalThis.VideoFrame
  globalThis.VideoFrame = MockVideoFrame

  t.after(() => {
    if (prevVideoFrame !== undefined) {
      globalThis.VideoFrame = prevVideoFrame
    } else {
      delete globalThis.VideoFrame
    }
  })

  const { renderer, deletedTextures, calls } = makeMockRenderer()
  const backend = new ThreeBackend(renderer)

  // 1. Valid borrowed VideoFrame (landscape, no rotation)
  const frame1 = new MockVideoFrame({
    displayWidth: 640,
    displayHeight: 480,
    visibleRect: { width: 640, height: 480, x: 0, y: 0 },
    rotation: 0,
  })
  const dim1 = backend.updateTextureFromSource('vf-cam', frame1, { flipY: true })
  assert.deepEqual(dim1, { width: 640, height: 480 })
  const texInfo1 = backend.textures.get('vf-cam')
  assert.ok(texInfo1)
  assert.equal(texInfo1.width, 640)
  assert.equal(texInfo1.height, 480)
  assert.equal(texInfo1.format, 'rgba8')
  assert.equal(texInfo1.isExternal, true)
  assert.ok(texInfo1.externalGL)

  // Verify flipY call
  const flipCall = calls.find((c) => c[0] === 'pixelStorei' && c[1] === 0x9240 && c[2] === true)
  assert.ok(flipCall, 'pixelStorei flipY was set to true')

  // 2. Rotated 90 degrees VideoFrame: display dimensions are swapped relative to visibleRect
  const frameRot90 = new MockVideoFrame({
    displayWidth: 480,
    displayHeight: 640,
    visibleRect: { width: 640, height: 480, x: 0, y: 0 },
    rotation: 90,
  })
  const dimRot90 = backend.updateTextureFromSource('vf-rot90', frameRot90)
  assert.deepEqual(dimRot90, { width: 480, height: 640 })

  // 3. Rotated 270 degrees VideoFrame
  const frameRot270 = new MockVideoFrame({
    displayWidth: 480,
    displayHeight: 640,
    visibleRect: { width: 640, height: 480, x: 0, y: 0 },
    rotation: 270,
  })
  const dimRot270 = backend.updateTextureFromSource('vf-rot270', frameRot270)
  assert.deepEqual(dimRot270, { width: 480, height: 640 })

  // 4. Anamorphic scaling rejection: displayWidth != visibleRect.width (matching reference WebGL2 behavior)
  const frameAnamorphic = new MockVideoFrame({
    displayWidth: 1920,
    displayHeight: 1080,
    visibleRect: { width: 1440, height: 1080, x: 0, y: 0 },
    rotation: 0,
  })
  const dimAnamorphic = backend.updateTextureFromSource('vf-bad', frameAnamorphic)
  assert.deepEqual(dimAnamorphic, { width: 0, height: 0 })
  assert.equal(backend.textures.get('vf-bad'), undefined)

  // 5. Zero dimension rejection
  const frameZero = new MockVideoFrame({
    displayWidth: 0,
    displayHeight: 480,
    visibleRect: { width: 0, height: 480, x: 0, y: 0 },
    rotation: 0,
  })
  const dimZero = backend.updateTextureFromSource('vf-zero', frameZero)
  assert.deepEqual(dimZero, { width: 0, height: 0 })

  // 6. Unknown source rejection
  const dimUnknown = backend.updateTextureFromSource('vf-unknown', { foo: 'bar' })
  assert.deepEqual(dimUnknown, { width: 0, height: 0 })

  // 7. Dimension resize recreates the GL texture and deletes the previous handle
  const oldHandle = texInfo1.externalGL
  const frameResized = new MockVideoFrame({
    displayWidth: 1280,
    displayHeight: 720,
    visibleRect: { width: 1280, height: 720, x: 0, y: 0 },
    rotation: 0,
  })
  const dimResized = backend.updateTextureFromSource('vf-cam', frameResized)
  assert.deepEqual(dimResized, { width: 1280, height: 720 })
  assert.ok(deletedTextures.includes(oldHandle), 'previous GL texture was deleted on resize')
  const newTexInfo = backend.textures.get('vf-cam')
  assert.notEqual(newTexInfo.externalGL, oldHandle)

  // 8. destroyTexture cleans up externalGL handle
  const currentHandle = newTexInfo.externalGL
  backend.destroyTexture('vf-cam')
  assert.ok(deletedTextures.includes(currentHandle), 'current GL texture was deleted on destroyTexture')
  assert.equal(backend.textures.has('vf-cam'), false)
})
