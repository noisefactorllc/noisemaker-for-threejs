/**
 * ThreeBackend — implements the reference `Backend` interface on three.js.
 *
 * This is the ONLY substantial new code in the port. The reused, vendored
 * `Pipeline` drives it: it calls createTexture/compileProgram during init, then
 * per frame beginFrame → executePass×N (with ping-pong surface resolution via
 * `state`) → endFrame → present. We mirror the behavior of the reference
 * runtime/backends/webgl2.js exactly so pixel-parity is automatic.
 *
 * Scope (MVP→Phase3): single-output + blit passes, global-surface ping-pong,
 * uniform/texture binding, float readback. MRT, points/billboards, blend, repeat,
 * 3D/cube, and external media are staged (clearly marked) for later phases.
 */
import * as THREE from 'three'
import { Backend } from '../vendor/noisemaker/shaders/src/runtime/backend.js'
import { formatToType, fullscreenTriangle, stripVersion, DEFAULT_VERTEX_SHADER } from './three-resources.js'

// Parity + integration require pure-linear pixels everywhere: no sRGB decode on
// textures, no encode on output. Disabling ColorManagement globally is the simplest
// guarantee (covers NoisemakerCanvas, NoisemakerTexture, NoisemakerPass).
THREE.ColorManagement.enabled = false

const PRESENT_FRAGMENT = `precision highp float;
in vec2 v_texCoord;
uniform sampler2D tex;
out vec4 fragColor;
void main() { fragColor = texture(tex, v_texCoord); }
`

function hexToRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function toUniformValue(v) {
  if (typeof v === 'boolean') return v ? 1 : 0
  // Color params may default to hex strings (e.g. matteColor "#000000"); three.js needs
  // an [r,g,b] array. (The reference's raw uniform3fv coerces hex->NaN; we resolve correctly.)
  if (typeof v === 'string' && v[0] === '#') return hexToRgb(v)
  return v // numbers, arrays (three handles vecN/array), THREE.Texture
}

export class ThreeBackend extends Backend {
  constructor(renderer, options = {}) {
    super({})
    this.renderer = renderer
    // Canvas presents the render surface to the screen; Texture/Pass keep it offscreen
    // (presenting would clobber the caller's framebuffer).
    this.presentToScreen = options.presentToScreen !== false
    this.gl = renderer.getContext()
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.geometry = fullscreenTriangle()
    this.mesh = new THREE.Mesh(this.geometry, new THREE.RawShaderMaterial())
    this.mesh.frustumCulled = false // VS writes gl_Position directly; no bounds
    this.scene.add(this.mesh)
    this.presentMaterial = null
    this.presentedTextureId = null
  }

  async init() {
    this.renderer.autoClear = false
    this.presentMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: DEFAULT_VERTEX_SHADER,
      fragmentShader: PRESENT_FRAGMENT,
      uniforms: { tex: { value: null } },
      depthTest: false,
      depthWrite: false,
    })
  }

  getName() {
    return 'three'
  }

  static isAvailable() {
    return true
  }

  // --- texture management ---
  createTexture(id, spec) {
    const width = spec.width | 0
    const height = spec.height | 0
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: formatToType(spec.format),
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      // Reference 2D textures are NEAREST + CLAMP_TO_EDGE (webgl2.js). Parity-critical.
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    })
    rt.texture.colorSpace = THREE.NoColorSpace
    const info = { target: rt, texture: rt.texture, width, height, format: spec.format, handle: rt }
    this.textures.set(id, info)
    // Initialize to transparent black, like the reference webgl2 createTexture/createFBO.
    // three.js leaves new RTs uninitialized; state sims (e.g. cellularAutomata) would
    // diverge from garbage initial contents.
    const prev = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(rt)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear(true, false, false)
    this.renderer.setRenderTarget(prev)
    return info
  }

  createTexture3D(id, _spec) {
    // Staged: synth3d/filter3d (Phase 5.5). Throw loudly so it is never silently wrong.
    throw new Error(`ThreeBackend.createTexture3D not yet implemented (${id})`)
  }

  destroyTexture(id) {
    const info = this.textures.get(id)
    if (info?.target) info.target.dispose()
    this.textures.delete(id)
  }

  clearTexture(id) {
    const info = this.textures.get(id)
    if (!info) return
    const prevTarget = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(info.target)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear(true, false, false)
    this.renderer.setRenderTarget(prevTarget)
  }

  // --- shader compilation ---
  async compileProgram(id, spec) {
    const source = spec.glsl || spec.source || spec.fragment
    if (!source) throw new Error(`compileProgram: no GLSL source for ${id}`)
    // Match the reference webgl2 injectDefines EXACTLY: prepend precision + defines
    // as `#define KEY value` (stringified, so booleans stay `true`/`false` — GLSL ES
    // `if (X)` needs a bool, not an int). Do NOT use three.js material.defines: it
    // coerces/omits values (false is dropped) and would diverge from the reference.
    // three.js (glslVersion: GLSL3) still prepends `#version 300 es`, giving the
    // reference order: #version, precision, defines, source.
    let definesBlock = 'precision highp float;\nprecision highp int;\n'
    for (const [k, v] of Object.entries(spec.defines || {})) {
      definesBlock += `#define ${k} ${v}\n`
    }
    const fragmentShader = definesBlock + stripVersion(source)
    const vertexShader = spec.vertex ? stripVersion(spec.vertex) : DEFAULT_VERTEX_SHADER
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {},
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })
    this.programs.set(id, { material, spec })
    return { material }
  }

  // --- surface name resolution (mirrors webgl2.parseGlobalName) ---
  parseGlobalName(texId) {
    if (typeof texId !== 'string') return null
    if (texId.startsWith('global_')) return texId.replace('global_', '')
    if (texId.startsWith('global') && texId.length > 6) {
      const suffix = texId.slice(6)
      if (/^[A-Z0-9]/.test(suffix)) return suffix.charAt(0).toLowerCase() + suffix.slice(1)
    }
    return null
  }

  resolveInputTexture(texId, state) {
    const globalName = this.parseGlobalName(texId)
    if (globalName) {
      const scoped = this.textures.get(texId)
      if (scoped) return scoped.texture
      const surf = state.surfaces?.[globalName]
      if (surf) return surf.texture
      return null
    }
    return this.textures.get(texId)?.texture ?? null
  }

  resolveOutputTarget(pass, state) {
    let outputId = pass.outputs?.color ?? Object.values(pass.outputs || {})[0]
    const globalName = this.parseGlobalName(outputId)
    if (globalName && state.writeSurfaces && state.writeSurfaces[globalName]) {
      outputId = state.writeSurfaces[globalName]
    }
    return this.textures.get(outputId)?.target ?? null
  }

  setUniform(material, name, value) {
    let u = material.uniforms[name]
    if (!u) {
      u = { value: null }
      material.uniforms[name] = u
    }
    u.value = toUniformValue(value)
  }

  // --- frame ---
  beginFrame(_state) {
    this.renderer.autoClear = false
  }

  endFrame() {}

  // Bind globals, pass uniforms (override), input textures, and blend state onto a
  // pass's material. Shared by all draw paths (single / MRT / points).
  bindMaterial(pass, state) {
    const prog = this.programs.get(pass.program)
    if (!prog) throw new Error(`ThreeBackend: program not found: ${pass.program} (pass ${pass.id})`)
    const material = prog.material
    if (state.globalUniforms) {
      for (const [k, v] of Object.entries(state.globalUniforms)) this.setUniform(material, k, v)
    }
    if (pass.uniforms) {
      for (const [k, v] of Object.entries(pass.uniforms)) this.setUniform(material, k, v)
    }
    if (pass.inputs) {
      for (const [samplerName, texId] of Object.entries(pass.inputs)) {
        this.setUniform(material, samplerName, this.resolveInputTexture(texId, state))
      }
    }
    // Additive blend (reference uses gl.blendFunc(ONE,ONE)) for deposit/accumulation passes.
    if (pass.blend) {
      material.blending = THREE.CustomBlending
      material.blendEquation = THREE.AddEquation
      material.blendSrc = THREE.OneFactor
      material.blendDst = THREE.OneFactor
      material.transparent = true
    } else if (material.blending !== THREE.NoBlending) {
      material.blending = THREE.NoBlending
      material.transparent = false
    }
    return material
  }

  executePass(pass, state) {
    const outputKeys = Object.keys(pass.outputs || {})
    const isMRT = pass.drawBuffers > 1 || outputKeys.length > 1
    const material = this.bindMaterial(pass, state)

    if (isMRT) return this.executeMRT(pass, state, outputKeys, material)
    if (pass.drawMode === 'points' || pass.drawMode === 'billboards') {
      return this.executePoints(pass, state, material)
    }

    this.mesh.material = material
    this.renderer.setRenderTarget(this.resolveOutputTarget(pass, state))
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
  }

  // Resolve an output id (handling global-surface write resolution) to its texture info.
  resolveOutputInfo(outputId, state) {
    const globalName = this.parseGlobalName(outputId)
    if (globalName && state.writeSurfaces && state.writeSurfaces[globalName]) {
      outputId = state.writeSurfaces[globalName]
    }
    return this.textures.get(outputId)
  }

  // Cached host count:N WebGLRenderTarget (three owns its FBO + sets drawBuffers[0..N-1]).
  getMRTHost(n, w, h) {
    const key = `${n}_${w}_${h}`
    let host = this._mrtHosts?.get(key)
    if (!host) {
      host = new THREE.WebGLRenderTarget(w, h, { count: n, depthBuffer: false, stencilBuffer: false })
      ;(this._mrtHosts ||= new Map()).set(key, host)
    }
    return host
  }

  /**
   * Mixed-format MRT: three.js WebGLRenderTarget{count:N} forces one format for all
   * attachments, but agent state mixes formats (rgba32f xyz/vel + rgba8 rgba). So we
   * drive a host count:N RT (for three's FBO + drawBuffers[0..N-1] + viewport), then
   * re-attach OUR separate per-format textures to that FBO before rendering.
   */
  executeMRT(pass, state, outputKeys, material) {
    const gl = this.gl
    const outInfos = outputKeys.map((k) => this.resolveOutputInfo(pass.outputs[k], state))
    if (outInfos.some((i) => !i)) throw new Error(`ThreeBackend MRT: missing output texture (pass ${pass.id})`)
    const n = outInfos.length
    const { width: w, height: h } = outInfos[0]
    const host = this.getMRTHost(n, w, h)

    this.mesh.material = material
    this.renderer.setRenderTarget(host) // sets up FBO + drawBuffers[0..n-1] + viewport
    const fbo = this.renderer.properties.get(host).__webglFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    for (let i = 0; i < n; i++) {
      const glTex = this.renderer.properties.get(outInfos[i].texture).__webglTexture
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, glTex, 0)
    }
    this.renderer.render(this.scene, this.camera) // writes to our re-attached textures
    this.renderer.setRenderTarget(null)
  }

  // Points / billboards draw: agents scatter to an accumulation target. The VS reads
  // agent-state textures by gl_VertexID and sets gl_Position + gl_PointSize.
  executePoints(pass, state, material) {
    const count = this.resolvePointCount(pass, state)
    const verts = pass.drawMode === 'billboards' ? count * 6 : count
    let geo = this._pointGeoCache?.get(verts)
    if (!geo) {
      geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
      ;(this._pointGeoCache ||= new Map()).set(verts, geo)
    }
    const drawObj =
      pass.drawMode === 'billboards'
        ? (this._billboardMesh ||= new THREE.Mesh(geo, material))
        : (this._points ||= new THREE.Points(geo, material))
    drawObj.geometry = geo
    drawObj.material = material
    drawObj.frustumCulled = false
    const scene = (this._drawScene ||= new THREE.Scene())
    scene.clear()
    scene.add(drawObj)
    this.renderer.setRenderTarget(this.resolveOutputTarget(pass, state))
    this.renderer.render(scene, this.camera)
    this.renderer.setRenderTarget(null)
  }

  resolvePointCount(pass, state) {
    let count = pass.count ?? 1000
    if (count === 'auto' || count === 'screen' || count === 'input') {
      let refTex = null
      if (count === 'input' && pass.inputs) {
        const stateInputId = pass.inputs.xyzTex || pass.inputs.inputTex
        if (stateInputId) {
          const g = this.parseGlobalName(stateInputId)
          refTex = g ? state.surfaces?.[g] : this.textures.get(stateInputId)
        }
      } else {
        const outId = pass.outputs?.color ?? Object.values(pass.outputs || {})[0]
        refTex = this.resolveOutputInfo(outId, state)
      }
      const sw = state.screenWidth || this.renderer.getContext().drawingBufferWidth
      const sh = state.screenHeight || this.renderer.getContext().drawingBufferHeight
      count = refTex?.width && refTex?.height ? refTex.width * refTex.height : sw * sh
    }
    return count | 0
  }

  present(textureId) {
    this.presentedTextureId = textureId
    if (!this.presentToScreen) return // offscreen mode (Texture/Pass): expose RT, don't blit
    const info = this.textures.get(textureId)
    if (!info || !this.presentMaterial) return
    // On-screen blit for live use (NOT on the parity path; readback reads the RT).
    this.presentMaterial.uniforms.tex.value = info.texture
    this.mesh.material = this.presentMaterial
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  /** The texture last presented by the pipeline (current render-surface read buffer). */
  getPresentedTexture() {
    return this.textures.get(this.presentedTextureId)?.texture ?? null
  }

  /** Copy a source texture into an arbitrary render target (for NoisemakerTexture's stable output). */
  blitToTarget(srcTexture, dstTarget) {
    if (!srcTexture || !this.presentMaterial) return
    this.presentMaterial.uniforms.tex.value = srcTexture
    this.mesh.material = this.presentMaterial
    this.renderer.setRenderTarget(dstTarget)
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
  }

  /**
   * Read back a render-surface texture as LINEAR FLOAT, matching the golden's
   * gl.readPixels(RGBA, FLOAT) on the o0 surface (export-golden.mjs). Returns a
   * bottom-up Float32Array; the harness quantizes round(v*255) and flips to top-down,
   * identical to the golden encoder.
   */
  readPixels(textureId) {
    const id = textureId ?? this.presentedTextureId
    const info = this.textures.get(id)
    if (!info) throw new Error(`readPixels: no texture ${id}`)
    const { target, width, height } = info
    const gl = this.gl
    this.renderer.setRenderTarget(target) // binds target's framebuffer
    const buf = new Float32Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buf)
    this.renderer.setRenderTarget(null)
    return { width, height, data: buf }
  }

  // --- staged (later phases) ---
  copyTexture(srcId, dstId) {
    const src = this.textures.get(srcId)
    const dst = this.textures.get(dstId)
    if (!src || !dst || !this.presentMaterial) return
    this.presentMaterial.uniforms.tex.value = src.texture
    this.mesh.material = this.presentMaterial
    this.renderer.setRenderTarget(dst.target)
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
  }

  updateTextureFromSource(_id, _source, _opts) {
    throw new Error('ThreeBackend.updateTextureFromSource not yet implemented')
  }

  uploadDataTexture(id, data, width, height) {
    // Float32 RGBA data texture (e.g. the MIDI note grid 128x16). Sampled as a normal
    // input via resolveInputTexture(id).
    let info = this.textures.get(id)
    if (info?.dataTexture && info.width === width && info.height === height) {
      info.dataTexture.image.data = data
      info.dataTexture.needsUpdate = true
      return
    }
    if (info?.dataTexture) info.dataTexture.dispose()
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
    tex.colorSpace = THREE.NoColorSpace
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    this.textures.set(id, { texture: tex, dataTexture: tex, width, height, format: 'rgba32f' })
  }

  destroy() {
    for (const id of Array.from(this.textures.keys())) this.destroyTexture(id)
    for (const { material } of this.programs.values()) material?.dispose?.()
    this.programs.clear()
    this.geometry?.dispose?.()
    this.presentMaterial?.dispose?.()
  }
}
