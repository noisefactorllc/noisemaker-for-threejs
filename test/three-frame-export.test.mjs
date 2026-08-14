import { test } from 'node:test'
import assert from 'node:assert'
import { bootEngine } from '../vendor/engine.mjs'

const { core } = await bootEngine()

class FakeGL {
  constructor () {
    Object.assign(this, {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      TEXTURE_2D: 5,
      RGBA8: 6,
      RGBA: 7,
      UNSIGNED_BYTE: 8,
      TEXTURE_MIN_FILTER: 9,
      TEXTURE_MAG_FILTER: 10,
      TEXTURE_WRAP_S: 11,
      TEXTURE_WRAP_T: 12,
      NEAREST: 13,
      CLAMP_TO_EDGE: 14,
      FRAMEBUFFER: 15,
      COLOR_ATTACHMENT0: 16,
      FRAMEBUFFER_COMPLETE: 17,
      PIXEL_PACK_BUFFER: 18,
      STREAM_READ: 19,
      BLEND: 20,
      DEPTH_TEST: 21,
      SCISSOR_TEST: 22,
      CULL_FACE: 23,
      TEXTURE0: 24,
      TRIANGLES: 25,
      SYNC_GPU_COMMANDS_COMPLETE: 26,
      TIMEOUT_EXPIRED: 27,
      ALREADY_SIGNALED: 28,
      CONDITION_SATISFIED: 29,
      WAIT_FAILED: 30,
    })
    this.calls = []
    this.deleted = []
    this.boundPbo = null
    this.lastFence = null
    this.nextId = 0
  }

  object (kind) { return { kind, id: ++this.nextId } }
  call (name, ...args) { this.calls.push([name, ...args]) }
  createShader (type) { this.call('createShader', type); return this.object('shader') }
  shaderSource (...args) { this.call('shaderSource', ...args) }
  compileShader (...args) { this.call('compileShader', ...args) }
  getShaderParameter () { return true }
  getShaderInfoLog () { return '' }
  deleteShader (value) { this.deleted.push(value) }
  createProgram () { return this.object('program') }
  attachShader (...args) { this.call('attachShader', ...args) }
  linkProgram (...args) { this.call('linkProgram', ...args) }
  getProgramParameter () { return true }
  getProgramInfoLog () { return '' }
  getUniformLocation (_program, name) { return { name } }
  deleteProgram (value) { this.deleted.push(value) }
  createVertexArray () { return this.object('vao') }
  deleteVertexArray (value) { this.deleted.push(value) }
  bindVertexArray (...args) { this.call('bindVertexArray', ...args) }
  createTexture () { return this.object('texture') }
  bindTexture (...args) { this.call('bindTexture', ...args) }
  texImage2D (...args) { this.call('texImage2D', ...args) }
  texParameteri (...args) { this.call('texParameteri', ...args) }
  deleteTexture (value) { this.deleted.push(value) }
  createFramebuffer () { return this.object('framebuffer') }
  bindFramebuffer (...args) { this.call('bindFramebuffer', ...args) }
  framebufferTexture2D (...args) { this.call('framebufferTexture2D', ...args) }
  checkFramebufferStatus () { return this.FRAMEBUFFER_COMPLETE }
  deleteFramebuffer (value) { this.deleted.push(value) }
  createBuffer () { return this.object('buffer') }
  bindBuffer (_target, value) { this.boundPbo = value }
  bufferData (_target, byteLength) { this.boundPbo.bytes = new Uint8Array(byteLength) }
  deleteBuffer (value) { this.deleted.push(value) }
  viewport (...args) { this.call('viewport', ...args) }
  disable (...args) { this.call('disable', ...args) }
  useProgram (...args) { this.call('useProgram', ...args) }
  activeTexture (...args) { this.call('activeTexture', ...args) }
  uniform1i (...args) { this.call('uniform1i', ...args) }
  drawArrays (...args) { this.call('drawArrays', ...args) }
  readPixels (_x, _y, width, height) {
    for (let index = 0; index < width * height * 4; index++) {
      this.boundPbo.bytes[index] = index & 0xff
    }
  }
  fenceSync () {
    this.lastFence = this.object('fence')
    this.lastFence.status = this.TIMEOUT_EXPIRED
    return this.lastFence
  }
  flush () { this.call('flush') }
  clientWaitSync (fence) { return fence.status }
  deleteSync (value) { this.deleted.push(value) }
  getBufferSubData (_target, _offset, destination) {
    destination.set(this.boundPbo.bytes)
  }
}

function makeBackend (width = 4, height = 2) {
  const gl = new FakeGL()
  const sourceTexture = { kind: 'three-texture' }
  const sourceHandle = { kind: 'webgl-texture' }
  let resetCalls = 0
  let resetFailures = 0
  const backend = {
    gl,
    textures: new Map([['source', { texture: sourceTexture, width, height }]]),
    renderer: {
      properties: {
        get (texture) {
          if (!texture) throw new TypeError('invalid WeakMap key')
          return texture === sourceTexture ? { __webglTexture: sourceHandle } : {}
        },
      },
      resetState () {
        resetCalls++
        if (resetFailures > 0) {
          resetFailures--
          throw new Error('injected renderer reset failure')
        }
      },
    },
  }
  return {
    backend,
    gl,
    sourceHandle,
    failNextReset: () => { resetFailures++ },
    resetCalls: () => resetCalls,
  }
}

function descriptor (alphaMode = 'straight') {
  return {
    width: 4,
    height: 2,
    format: 'rgba8unorm',
    colorSpace: 'srgb',
    alphaMode,
    fps: 60,
  }
}

test('Three frame export uses the shared bounded queue with stable slot storage', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const harness = makeBackend()
  const backend = Object.assign(Object.create(ThreeBackend.prototype), harness.backend)
  const queue = backend.createFrameExportQueue({ slots: 2 })
  assert.ok(queue instanceof core.FrameExportQueue)
  queue.configure(descriptor())

  const firstSlot = queue._slots[0].adapterSlot
  const frames = []
  assert.equal(queue.enqueue('source', -2.5, (frame, timestamp) => {
    frames.push({ frame, timestamp })
  }), true)
  assert.equal(queue.enqueue('source', 2, () => {}), true)
  assert.equal(queue.enqueue('source', 3, () => assert.fail('overflow callback ran')), false)
  for (const record of queue._slots) record.adapterSlot.fence.status = harness.gl.CONDITION_SATISFIED
  queue.poll()

  assert.equal(frames.length, 1)
  assert.equal(frames[0].timestamp, -2.5)
  assert.equal(frames[0].frame, firstSlot.frame)
  assert.equal(frames[0].frame.data, firstSlot.data)
  assert.deepEqual(Array.from(frames[0].frame.data),
    Array.from({ length: 32 }, (_, index) => index))
  assert.deepEqual(queue.stats, { accepted: 2, dropped: 1, completed: 2, failed: 0 })
  assert.ok(harness.resetCalls() > 0)
  assert.equal(harness.gl.calls.some(call => call[0] === 'pixelStorei'), false)

  queue.close()
  queue.close()
  assert.equal(queue.available, false)
  assert.equal(new Set(harness.gl.deleted).size, harness.gl.deleted.length,
    'each raw WebGL resource is deleted once')
})

test('Three frame export rejects invalid descriptors and missing Three texture handles', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const harness = makeBackend()
  const backend = Object.assign(Object.create(ThreeBackend.prototype), harness.backend)

  const invalid = backend.createFrameExportQueue()
  assert.throws(() => invalid.configure({ ...descriptor(), format: 'rgba8' }), /format/i)

  const errors = []
  const queue = backend.createFrameExportQueue({
    onError (error) { errors.push(error.message) },
  })
  queue.configure(descriptor('opaque'))
  assert.equal(queue.enqueue('missing', 0, () => {}), false)
  assert.match(errors.at(-1), /texture missing not found/i)
  backend.renderer.properties.get = () => ({})
  assert.equal(queue.enqueue('source', 0, () => {}), false)
  assert.equal(queue.stats.failed, 2)
  assert.match(errors.at(-1), /texture source not found/i)
  assert.equal(queue.available, true)
  queue.close()
})

test('renderer reset failures clean configuration resources and leave enqueue slots reusable', async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')

  const configureHarness = makeBackend()
  const configureBackend = Object.assign(
    Object.create(ThreeBackend.prototype),
    configureHarness.backend,
  )
  const configureQueue = configureBackend.createFrameExportQueue({ slots: 2 })
  configureHarness.failNextReset()
  assert.throws(() => configureQueue.configure(descriptor()), /reset failure/)
  assert.equal(configureQueue.adapter.slotCount, 0)
  assert.equal(configureQueue.adapter.program, null)

  const enqueueHarness = makeBackend()
  const enqueueBackend = Object.assign(
    Object.create(ThreeBackend.prototype),
    enqueueHarness.backend,
  )
  const enqueueQueue = enqueueBackend.createFrameExportQueue({ slots: 2 })
  enqueueQueue.configure(descriptor())
  enqueueHarness.failNextReset()
  assert.equal(enqueueQueue.enqueue('source', 1, () => {}), false)
  assert.equal(enqueueQueue.stats.failed, 1)
  assert.equal(enqueueQueue.enqueue('source', 2, () => {}), true)
  enqueueQueue.close()
})

test('NoisemakerCanvas delegates sink and frame-export APIs to its active pipeline', async () => {
  const { NoisemakerCanvas } = await import('../src/integration/canvas.js')
  const canvas = Object.create(NoisemakerCanvas.prototype)
  canvas.pipeline = null
  assert.throws(() => canvas.addSink({}), /compile/i)
  assert.throws(() => canvas.createFrameExportQueue(), /compile/i)

  const sink = { configure () {}, submit () {}, close () {} }
  const removal = () => {}
  const queue = { kind: 'queue' }
  let receivedSink
  let receivedOptions
  canvas.pipeline = {
    addSink (value) { receivedSink = value; return removal },
    backend: {
      createFrameExportQueue (options) { receivedOptions = options; return queue },
    },
  }

  assert.equal(canvas.addSink(sink), removal)
  assert.equal(receivedSink, sink)
  assert.equal(canvas.createFrameExportQueue({ slots: 4 }), queue)
  assert.deepEqual(receivedOptions, { slots: 4 })
})

test('offscreen wrappers dispose their Pipeline so registered sinks are closed', async () => {
  const { NoisemakerTexture } = await import('../src/integration/texture.js')
  const { NoisemakerPass } = await import('../src/integration/pass.js')

  for (const Wrapper of [NoisemakerTexture, NoisemakerPass]) {
    const wrapper = Object.create(Wrapper.prototype)
    let pipelineDisposals = 0
    let backendDestructions = 0
    let targetDisposals = 0
    wrapper.pipeline = {
      dispose () { pipelineDisposals++ },
      backend: { destroy () { backendDestructions++ } },
    }
    if (Wrapper === NoisemakerTexture) {
      wrapper.outputRT = { dispose () { targetDisposals++ } }
    }

    wrapper.dispose()

    assert.equal(pipelineDisposals, 1)
    assert.equal(backendDestructions, 0)
    assert.equal(targetDisposals, Wrapper === NoisemakerTexture ? 1 : 0)
  }
})

test('wrapper-owned GPU resources still dispose when Pipeline sink cleanup fails', async () => {
  const { NoisemakerCanvas } = await import('../src/integration/canvas.js')
  const { NoisemakerTexture } = await import('../src/integration/texture.js')

  const canvas = Object.create(NoisemakerCanvas.prototype)
  let rendererDisposals = 0
  canvas.pipeline = { dispose () { throw new Error('sink close failed') } }
  canvas.renderer = { dispose () { rendererDisposals++ } }
  assert.throws(() => canvas.dispose(), /sink close failed/)
  assert.equal(rendererDisposals, 1)

  const texture = Object.create(NoisemakerTexture.prototype)
  let targetDisposals = 0
  texture.pipeline = { dispose () { throw new Error('sink close failed') } }
  texture.outputRT = { dispose () { targetDisposals++ } }
  assert.throws(() => texture.dispose(), /sink close failed/)
  assert.equal(targetDisposals, 1)
})
