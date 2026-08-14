const ALPHA_MODE = Object.freeze({
  straight: 0,
  opaque: 1,
  premultiplied: 2,
})

const RESOLVE_VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  const vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
  );
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`

const RESOLVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_texture;
uniform int u_alphaMode;
out vec4 fragColor;
void main() {
  ivec2 sourceSize = textureSize(u_texture, 0);
  ivec2 sourceCoord = ivec2(
    int(gl_FragCoord.x),
    sourceSize.y - 1 - int(gl_FragCoord.y)
  );
  vec4 color = texelFetch(u_texture, sourceCoord, 0);
  if (u_alphaMode == 1) {
    color.a = 1.0;
  } else if (u_alphaMode == 2) {
    color.rgb *= color.a;
  }
  fragColor = color;
}
`

function validateDescriptor (descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('Frame export descriptor must be an object')
  }
  if (!Number.isSafeInteger(descriptor.width) || descriptor.width <= 0) {
    throw new RangeError('Frame export width must be a positive integer')
  }
  if (!Number.isSafeInteger(descriptor.height) || descriptor.height <= 0) {
    throw new RangeError('Frame export height must be a positive integer')
  }
  if (descriptor.format !== 'rgba8unorm') {
    throw new TypeError("Three frame export format must be 'rgba8unorm'")
  }
  if (descriptor.colorSpace !== 'srgb' && descriptor.colorSpace !== 'display-p3') {
    throw new TypeError("Three frame export colorSpace must be 'srgb' or 'display-p3'")
  }
  if (!Object.hasOwn(ALPHA_MODE, descriptor.alphaMode)) {
    throw new TypeError("Three frame export alphaMode must be 'opaque', 'straight', or 'premultiplied'")
  }
  if (!Number.isFinite(descriptor.fps) || descriptor.fps <= 0) {
    throw new RangeError('Frame export fps must be finite and positive')
  }
  const byteLength = descriptor.width * descriptor.height * 4
  if (!Number.isSafeInteger(byteLength)) {
    throw new RangeError('Frame export dimensions are too large')
  }
  return byteLength
}

function deleteIfPresent (gl, method, value) {
  if (value) gl[method](value)
}

export class ThreeFrameExportAdapter {
  constructor (backend) {
    if (!backend?.gl || !(backend.textures instanceof Map) || !backend.renderer) {
      throw new TypeError('Three frame export requires a ThreeBackend')
    }
    this.backend = backend
    this.gl = backend.gl
    this.program = null
    this.vao = null
    this.textureLocation = null
    this.alphaModeLocation = null
    this.slotCount = 0
  }

  createSlot (index, descriptor) {
    const byteLength = validateDescriptor(descriptor)
    const gl = this.gl
    const data = new Uint8Array(byteLength)
    const slot = {
      index,
      width: descriptor.width,
      height: descriptor.height,
      alphaMode: ALPHA_MODE[descriptor.alphaMode],
      texture: null,
      framebuffer: null,
      pbo: null,
      fence: null,
      ready: false,
      destroyed: false,
      registered: false,
      data,
      frame: {
        width: descriptor.width,
        height: descriptor.height,
        rowStride: descriptor.width * 4,
        data,
      },
    }

    try {
      this.ensureProgram()
      slot.texture = gl.createTexture()
      if (!slot.texture) throw new Error('Failed to create Three frame export resolve texture')
      gl.bindTexture(gl.TEXTURE_2D, slot.texture)
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA8, slot.width, slot.height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      slot.framebuffer = gl.createFramebuffer()
      if (!slot.framebuffer) throw new Error('Failed to create Three frame export framebuffer')
      gl.bindFramebuffer(gl.FRAMEBUFFER, slot.framebuffer)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, slot.texture, 0,
      )
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Three frame export framebuffer is incomplete')
      }

      slot.pbo = gl.createBuffer()
      if (!slot.pbo) throw new Error('Failed to create Three frame export pixel buffer')
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo)
      gl.bufferData(gl.PIXEL_PACK_BUFFER, byteLength, gl.STREAM_READ)
      this.resetState()
      slot.registered = true
      this.slotCount++
      return slot
    } catch (error) {
      try {
        this.destroyResources(slot)
      } catch {
        // Preserve the allocation or renderer-state failure.
      }
      if (this.slotCount === 0) {
        try {
          this.destroyProgram()
        } catch {
          // Preserve the allocation or renderer-state failure.
        }
      }
      try {
        this.resetState()
      } catch {
        // Preserve the allocation or renderer-state failure.
      }
      throw error
    }
  }

  begin (slot, textureId) {
    this.assertUsableSlot(slot)
    if (slot.fence) throw new Error('Three frame export slot is already pending')

    const source = this.backend.textures.get(textureId)
    if (!source) {
      throw new Error(`Three frame export texture ${String(textureId)} not found`)
    }
    const sourceHandle = source.externalGL ??
      this.backend.renderer.properties.get(source.texture)?.__webglTexture
    if (!sourceHandle) {
      throw new Error(`Three frame export texture ${String(textureId)} not found`)
    }
    if (source.width !== slot.width || source.height !== slot.height) {
      throw new Error(
        `Three frame export source extent ${String(source.width)}x${String(source.height)} ` +
        `does not match configured extent ${slot.width}x${slot.height}`,
      )
    }

    const gl = this.gl
    slot.ready = false
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, slot.framebuffer)
      gl.viewport(0, 0, slot.width, slot.height)
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.SCISSOR_TEST)
      gl.disable(gl.CULL_FACE)
      gl.useProgram(this.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceHandle)
      gl.uniform1i(this.textureLocation, 0)
      gl.uniform1i(this.alphaModeLocation, slot.alphaMode)
      gl.bindVertexArray(this.vao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo)
      gl.readPixels(0, 0, slot.width, slot.height, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      slot.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      if (!slot.fence) throw new Error('Failed to create Three frame export fence')
      gl.flush()
      this.resetState()
    } catch (error) {
      try {
        this.deleteFence(slot)
      } catch {
        // Preserve the GPU operation or renderer-state failure.
      }
      try {
        this.resetState()
      } catch {
        // Preserve the GPU operation or renderer-state failure.
      }
      throw error
    }
  }

  poll (slot) {
    this.assertUsableSlot(slot)
    if (!slot.fence) throw new Error('Three frame export slot has no pending fence')
    if (slot.ready) return true

    let status
    try {
      status = this.gl.clientWaitSync(slot.fence, 0, 0)
    } catch (error) {
      this.deleteFence(slot)
      throw error
    }
    if (status === this.gl.TIMEOUT_EXPIRED) return false
    if (status === this.gl.ALREADY_SIGNALED || status === this.gl.CONDITION_SATISFIED) {
      slot.ready = true
      return true
    }
    this.deleteFence(slot)
    if (status === this.gl.WAIT_FAILED) {
      throw new Error('Three frame export fence wait failed')
    }
    throw new Error(`Unexpected Three frame export fence status: ${String(status)}`)
  }

  read (slot) {
    this.assertUsableSlot(slot)
    if (!slot.fence || !slot.ready) {
      throw new Error('Three frame export slot is not ready after a signaled poll')
    }
    try {
      this.gl.bindBuffer(this.gl.PIXEL_PACK_BUFFER, slot.pbo)
      this.gl.getBufferSubData(this.gl.PIXEL_PACK_BUFFER, 0, slot.data)
      return slot.frame
    } finally {
      this.gl.bindBuffer(this.gl.PIXEL_PACK_BUFFER, null)
      this.deleteFence(slot)
    }
  }

  destroySlot (slot) {
    if (!slot || slot.destroyed) return
    slot.destroyed = true
    let firstError
    try {
      this.destroyResources(slot)
    } catch (error) {
      firstError = error
    }
    if (slot.registered) {
      slot.registered = false
      this.slotCount--
    }
    if (this.slotCount === 0) {
      try {
        this.destroyProgram()
      } catch (error) {
        if (!firstError) firstError = error
      }
    }
    try {
      this.resetState()
    } catch (error) {
      if (!firstError) firstError = error
    }
    if (firstError) throw firstError
  }

  assertUsableSlot (slot) {
    if (!slot || slot.destroyed || !slot.registered) {
      throw new Error('Three frame export slot is not usable')
    }
  }

  compileShader (type, source) {
    const shader = this.gl.createShader(type)
    if (!shader) throw new Error('Failed to create Three frame export shader')
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) || 'unknown compile error'
      this.gl.deleteShader(shader)
      throw new Error(`Failed to compile Three frame export shader: ${message}`)
    }
    return shader
  }

  ensureProgram () {
    if (this.program) return
    const gl = this.gl
    let vertexShader = null
    let fragmentShader = null
    try {
      vertexShader = this.compileShader(gl.VERTEX_SHADER, RESOLVE_VERTEX_SHADER)
      fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, RESOLVE_FRAGMENT_SHADER)
      this.program = gl.createProgram()
      if (!this.program) throw new Error('Failed to create Three frame export program')
      gl.attachShader(this.program, vertexShader)
      gl.attachShader(this.program, fragmentShader)
      gl.linkProgram(this.program)
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(this.program) || 'unknown link error'
        throw new Error(`Failed to link Three frame export program: ${message}`)
      }
      this.textureLocation = gl.getUniformLocation(this.program, 'u_texture')
      this.alphaModeLocation = gl.getUniformLocation(this.program, 'u_alphaMode')
      this.vao = gl.createVertexArray()
      if (!this.vao) throw new Error('Failed to create Three frame export vertex array')
    } catch (error) {
      deleteIfPresent(gl, 'deleteVertexArray', this.vao)
      deleteIfPresent(gl, 'deleteProgram', this.program)
      this.vao = null
      this.program = null
      throw error
    } finally {
      deleteIfPresent(gl, 'deleteShader', vertexShader)
      deleteIfPresent(gl, 'deleteShader', fragmentShader)
    }
  }

  deleteFence (slot) {
    if (slot.fence) this.gl.deleteSync(slot.fence)
    slot.fence = null
    slot.ready = false
  }

  destroyResources (slot) {
    this.deleteFence(slot)
    deleteIfPresent(this.gl, 'deleteBuffer', slot.pbo)
    deleteIfPresent(this.gl, 'deleteFramebuffer', slot.framebuffer)
    deleteIfPresent(this.gl, 'deleteTexture', slot.texture)
    slot.pbo = null
    slot.framebuffer = null
    slot.texture = null
  }

  destroyProgram () {
    deleteIfPresent(this.gl, 'deleteVertexArray', this.vao)
    deleteIfPresent(this.gl, 'deleteProgram', this.program)
    this.vao = null
    this.program = null
    this.textureLocation = null
    this.alphaModeLocation = null
  }

  resetState () {
    const gl = this.gl
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.useProgram(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.backend.renderer.resetState()
  }
}
