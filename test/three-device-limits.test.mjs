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

function makeGl({
  maxTextureSize = 8192,
  maxColorBytes = 32,
  framebufferAvailable = true,
  textureFailureAt = -1,
  probeError = false,
} = {}) {
  const readFramebuffer = { name: 'caller-read' }
  const drawFramebuffer = { name: 'caller-draw' }
  const boundTexture = { name: 'caller-texture' }
  let readBinding = readFramebuffer
  let drawBinding = drawFramebuffer
  let textureBinding = boundTexture
  let currentTexture = null
  let nextId = 0
  const attachments = new Map()
  const deletedTextures = []
  const deletedFramebuffers = []
  const framebufferBindCalls = []
  const errors = []
  let textureAllocationCount = 0

  const gl = {
    MAX_DRAW_BUFFERS: 1,
    MAX_TEXTURE_SIZE: 2,
    READ_FRAMEBUFFER_BINDING: 3,
    DRAW_FRAMEBUFFER_BINDING: 4,
    TEXTURE_BINDING_2D: 5,
    READ_FRAMEBUFFER: 6,
    DRAW_FRAMEBUFFER: 7,
    FRAMEBUFFER: 8,
    TEXTURE_2D: 9,
    RGBA32F: 10,
    RGBA16F: 11,
    RGBA: 12,
    FLOAT: 13,
    HALF_FLOAT: 14,
    COLOR_ATTACHMENT0: 20,
    FRAMEBUFFER_COMPLETE: 30,
    FRAMEBUFFER_UNSUPPORTED: 31,
    INVALID_OPERATION: 32,
    OUT_OF_MEMORY: 33,
    NO_ERROR: 0,

    getParameter(parameter) {
      if (parameter === this.MAX_DRAW_BUFFERS) return 8
      if (parameter === this.MAX_TEXTURE_SIZE) return maxTextureSize
      if (parameter === this.READ_FRAMEBUFFER_BINDING) return readBinding
      if (parameter === this.DRAW_FRAMEBUFFER_BINDING) return drawBinding
      if (parameter === this.TEXTURE_BINDING_2D) return textureBinding
      throw new Error(`unexpected getParameter(${parameter})`)
    },
    createFramebuffer() {
      if (!framebufferAvailable) {
        errors.push(this.OUT_OF_MEMORY)
        return null
      }
      return { name: `probe-fbo-${nextId++}` }
    },
    bindFramebuffer(target, framebuffer) {
      framebufferBindCalls.push({ target, framebuffer })
      if (target === this.READ_FRAMEBUFFER) readBinding = framebuffer
      else if (target === this.DRAW_FRAMEBUFFER) drawBinding = framebuffer
      else if (target === this.FRAMEBUFFER) readBinding = drawBinding = framebuffer
      else throw new Error(`unexpected framebuffer target ${target}`)
    },
    deleteFramebuffer(framebuffer) { deletedFramebuffers.push(framebuffer) },
    createTexture() {
      if (textureAllocationCount++ === textureFailureAt) {
        errors.push(this.OUT_OF_MEMORY)
        return null
      }
      return { name: `probe-texture-${nextId++}`, bytes: 0 }
    },
    bindTexture(target, texture) {
      assert.equal(target, this.TEXTURE_2D)
      textureBinding = texture
      currentTexture = texture
    },
    texImage2D(target, _level, internalFormat) {
      assert.equal(target, this.TEXTURE_2D)
      currentTexture.bytes = internalFormat === this.RGBA32F ? 16 : 8
    },
    framebufferTexture2D(target, attachment, _textureTarget, texture) {
      assert.equal(target, this.DRAW_FRAMEBUFFER)
      if (texture) attachments.set(attachment, texture)
      else attachments.delete(attachment)
    },
    drawBuffers() {},
    checkFramebufferStatus(target) {
      assert.equal(target, this.DRAW_FRAMEBUFFER)
      const bytes = [...attachments.values()].reduce((sum, texture) => sum + texture.bytes, 0)
      if (probeError && bytes > maxColorBytes) errors.push(this.INVALID_OPERATION)
      return bytes > 0 && bytes <= maxColorBytes
        ? this.FRAMEBUFFER_COMPLETE
        : this.FRAMEBUFFER_UNSUPPORTED
    },
    deleteTexture(texture) { deletedTextures.push(texture) },
    getError() { return errors.shift() ?? this.NO_ERROR },
  }

  return {
    gl,
    readFramebuffer,
    drawFramebuffer,
    boundTexture,
    deletedTextures,
    deletedFramebuffers,
    framebufferBindCalls,
    errors,
    bindings: () => ({ readBinding, drawBinding, textureBinding }),
  }
}

test('ThreeBackend reports device texture and MRT limits without disturbing shared GL state', async () => {
  const harness = makeGl({ maxTextureSize: 8192, maxColorBytes: 32, probeError: true })
  const renderer = { getContext: () => harness.gl }
  const backend = new ThreeBackend(renderer)

  await backend.init()

  assert.equal(backend.capabilities.maxTextureSize, 8192)
  assert.equal(backend.capabilities.maxDrawBuffers, 8)
  assert.equal(backend.capabilities.maxColorBytesPerSample, 32)
  assert.deepEqual(harness.bindings(), {
    readBinding: harness.readFramebuffer,
    drawBinding: harness.drawFramebuffer,
    textureBinding: harness.boundTexture,
  })
  assert.equal(harness.deletedFramebuffers.length, 1)
  assert.equal(harness.deletedTextures.length, 13)
  assert.deepEqual(harness.errors, [])
})

test('ThreeBackend falls back without touching the default framebuffer when probe allocation fails', async () => {
  const harness = makeGl({ framebufferAvailable: false })
  const backend = new ThreeBackend({ getContext: () => harness.gl })

  await backend.init()

  assert.equal(backend.capabilities.maxColorBytesPerSample, 16)
  assert.deepEqual(harness.framebufferBindCalls, [])
  assert.deepEqual(harness.deletedFramebuffers, [])
  assert.deepEqual(harness.deletedTextures, [])
  assert.deepEqual(harness.errors, [])
})

test('ThreeBackend cleans a partial MRT combination after a texture allocation failure', async () => {
  const harness = makeGl({ maxColorBytes: 32, textureFailureAt: 1 })
  const backend = new ThreeBackend({ getContext: () => harness.gl })

  await backend.init()

  assert.equal(backend.capabilities.maxColorBytesPerSample, 32)
  assert.equal(harness.deletedFramebuffers.length, 1)
  assert.equal(harness.deletedTextures.length, 10)
  assert.deepEqual(harness.bindings(), {
    readBinding: harness.readFramebuffer,
    drawBinding: harness.drawFramebuffer,
    textureBinding: harness.boundTexture,
  })
  assert.deepEqual(harness.errors, [])
})
