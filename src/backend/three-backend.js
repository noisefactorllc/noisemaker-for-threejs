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
import { Backend } from '../engine-browser.js'
import { formatToType, fullscreenTriangle, stripVersion, parseUniformSizes, DEFAULT_VERTEX_SHADER } from './three-resources.js'

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

// Coerce a uniform value to the shader's declared component count (comps in 2..4),
// mirroring the reference _setUniform: an array is truncated/zero-padded to length comps,
// a scalar is broadcast to [v,v,...]. This is what makes a `vec3` uniform fed a 4-element
// RGBA color array (`[r,g,b,1]`) upload correctly instead of failing gl.uniform3fv's
// multiple-of-3 length check (→ INVALID_VALUE → uniform stuck at 0/black). No-op for
// correct-length arrays, textures, and scalar→float (comps undefined or 1).
function fitVec(value, comps) {
  if (!comps || comps < 2) return value
  if (Array.isArray(value)) {
    if (value.length === comps) return value
    const out = new Array(comps)
    for (let i = 0; i < comps; i++) out[i] = value[i] ?? 0
    return out
  }
  if (typeof value === 'number') return new Array(comps).fill(value)
  return value
}

// --- std140 uniform-block (UBO) packing — mirrors reference webgl2.js exactly ---
// Effects with a `uniformLayout` (e.g. synth/remap's `layout(std140) uniform
// RemapUniforms { vec4 data[267]; }`) pack named values into vec4 slots. three.js
// only manages a UBO when given a UniformsGroup; the reference packs a flat
// `vec4 data[]` array, so we drive the binding by hand on the GL context three owns.
const UBO_COMPONENT_OFFSET = { x: 0, y: 4, z: 8, w: 12 }

function normalizePackedUniformLayout(layout) {
  if (Array.isArray(layout)) return layout
  const out = []
  for (const [name, spec] of Object.entries(layout || {})) {
    out.push({ name, slot: spec.slot, components: spec.components })
  }
  return out
}

function getPackedUniformLayoutSize(layout) {
  let maxSlot = 0
  for (const e of normalizePackedUniformLayout(layout)) maxSlot = Math.max(maxSlot, e.slot)
  return (maxSlot + 1) * 16
}

// Reference _resolveUniformAlias: width/height/channels fall back from resolution.
function resolveUniformAlias(name, uniforms) {
  if (uniforms[name] !== undefined) return uniforms[name]
  if (name === 'width' && uniforms.resolution) return uniforms.resolution[0]
  if (name === 'height' && uniforms.resolution) return uniforms.resolution[1]
  if (name === 'channels') return 4.0
  return undefined
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
    // Reusable std140 packing buffer (grown on demand) — mirrors reference.
    this._packedUniformBuffer = new ArrayBuffer(512)
    this._packedUniformView = new DataView(this._packedUniformBuffer)
    this._packedUniformBytes = new Uint8Array(this._packedUniformBuffer)
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
    // Free a raw GL handle WE created for an HTML/canvas source (updateTextureFromSource);
    // never the caller's bound GPU texture (setExternalTexture) — that's owned elsewhere.
    if (info?.externalGL) this.gl.deleteTexture(info.externalGL)
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
    this.programs.set(id, { material, spec, uniformSizes: parseUniformSizes(source) })
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
      // Externally-uploaded surfaces (mesh data) register under the UNSCOPED id, but the
      // expander hands passes chain-scoped ids (e.g. global_mesh0_positions_chain_0). Strip
      // the scope suffix to find them (mirrors the reference webgl2 mesh-input lookup).
      const unscoped = texId.replace(/_chain_\d+$/, '')
      if (unscoped !== texId) {
        const u = this.textures.get(unscoped)
        if (u) return u.texture
      }
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

  setUniform(material, name, value, sizes) {
    let u = material.uniforms[name]
    if (!u) {
      u = { value: null }
      material.uniforms[name] = u
    }
    u.value = fitVec(toUniformValue(value), sizes?.[name])
  }

  // --- std140 uniform blocks (UBO) ---

  // Extract the raw GL program three compiled for this material (version-tolerant).
  getGLProgram(material) {
    const props = this.renderer.properties.get(material)
    let wrapper = props?.currentProgram
    if (!wrapper && props?.programs?.size) wrapper = props.programs.values().next().value
    return wrapper?.program ?? null
  }

  // Create + bind a GL buffer for each uniform block (once per program). Mirrors
  // reference extractUniformBlocks; sizes to max(declared, packed-layout) bytes.
  extractUniformBlocks(glProgram, spec) {
    const gl = this.gl
    const blocks = []
    const count = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORM_BLOCKS)
    if (!count || !spec.uniformLayout) return blocks
    const layoutSize = getPackedUniformLayoutSize(spec.uniformLayout)
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniformBlockName(glProgram, i)
      if (!name) continue
      const declaredSize = gl.getActiveUniformBlockParameter(glProgram, i, gl.UNIFORM_BLOCK_DATA_SIZE)
      const size = Math.max(declaredSize, layoutSize)
      const bindingPoint = blocks.length // per-program; rebound before each draw
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
      gl.bufferData(gl.UNIFORM_BUFFER, size, gl.DYNAMIC_DRAW)
      gl.bindBuffer(gl.UNIFORM_BUFFER, null)
      gl.uniformBlockBinding(glProgram, i, bindingPoint)
      blocks.push({ name, index: i, bindingPoint, buffer, size, layout: spec.uniformLayout })
    }
    return blocks
  }

  // Compile the program (so its blocks are queryable) and set up its UBOs once.
  ensureUniformBlocks(prog, material) {
    if (prog.uniformBlocks) return // already attempted (may be [])
    this.mesh.material = material
    this.renderer.compile(this.scene, this.camera)
    const glProgram = this.getGLProgram(material)
    prog.uniformBlocks = glProgram ? this.extractUniformBlocks(glProgram, prog.spec) : []
  }

  // Pack `merged` into std140 slots and upload + bind each block (every draw).
  packUniformsWithLayout(uniforms, layout, minSize = 0) {
    const layoutArray = normalizePackedUniformLayout(layout)
    let maxSlot = 0
    for (const e of layoutArray) maxSlot = Math.max(maxSlot, e.slot)
    const bufferSize = Math.max(minSize, (maxSlot + 1) * 16)
    if (bufferSize > this._packedUniformBuffer.byteLength) {
      this._packedUniformBuffer = new ArrayBuffer(bufferSize)
      this._packedUniformView = new DataView(this._packedUniformBuffer)
      this._packedUniformBytes = new Uint8Array(this._packedUniformBuffer)
    }
    const view = this._packedUniformView
    this._packedUniformBytes.fill(0, 0, bufferSize)
    for (const entry of layoutArray) {
      let value = resolveUniformAlias(entry.name, uniforms)
      if (value === undefined || value === null) continue
      value = toUniformValue(value) // hex color -> [r,g,b], bool -> 0/1
      const slotOffset = entry.slot * 16
      const comps = entry.components
      if (comps.length === 1) {
        const offset = slotOffset + UBO_COMPONENT_OFFSET[comps]
        if (typeof value === 'number') view.setFloat32(offset, value, true)
      } else {
        const base = slotOffset + UBO_COMPONENT_OFFSET[comps[0]]
        if (Array.isArray(value)) {
          for (let i = 0; i < Math.min(value.length, comps.length); i++) {
            view.setFloat32(base + i * 4, value[i], true)
          }
        } else if (typeof value === 'number') {
          view.setFloat32(base, value, true)
        }
      }
    }
    return this._packedUniformBytes.subarray(0, bufferSize)
  }

  updateUniformBlocks(prog, merged) {
    const gl = this.gl
    for (const block of prog.uniformBlocks) {
      const data = this.packUniformsWithLayout(merged, block.layout, block.size)
      gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer)
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, block.bindingPoint, block.buffer)
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, null)
  }

  // For effects with a uniformLayout (remap), set up + upload their std140 UBO.
  // No-op for the ~180 effects without one. Called after bindMaterial, before draw.
  syncUniformBlocks(pass, state, material) {
    const prog = this.programs.get(pass.program)
    if (!prog?.spec?.uniformLayout) return
    this.ensureUniformBlocks(prog, material)
    if (!prog.uniformBlocks.length) return
    const merged = {}
    if (state.globalUniforms) Object.assign(merged, state.globalUniforms)
    if (pass.uniforms) Object.assign(merged, pass.uniforms) // pass overrides global
    this.updateUniformBlocks(prog, merged)
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
    const sizes = prog.uniformSizes
    if (state.globalUniforms) {
      for (const [k, v] of Object.entries(state.globalUniforms)) this.setUniform(material, k, v, sizes)
    }
    if (pass.uniforms) {
      for (const [k, v] of Object.entries(pass.uniforms)) this.setUniform(material, k, v, sizes)
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
    this.syncUniformBlocks(pass, state, material) // std140 UBO (remap); no-op otherwise

    if (isMRT) return this.executeMRT(pass, state, outputKeys, material)
    if (pass.drawMode === 'points' || pass.drawMode === 'billboards') {
      return this.executePoints(pass, state, material)
    }
    if (pass.drawMode === 'triangles') {
      return this.executeTriangles(pass, state, material)
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
   * gl.readPixels(RGBA, FLOAT) on the o0 surface (parity/timeseries.mjs). Returns a
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

  // Bind an already-resident GPU texture (e.g. an EffectComposer readBuffer, or a
  // NoisemakerTexture) under `id` so resolveInputTexture finds it as a pass input.
  // Marked external so destroyTexture never disposes the caller-owned texture.
  setExternalTexture(id, texture, width, height) {
    const existing = this.textures.get(id)
    if (existing && !existing.external) this.destroyTexture(id) // replace an owned RT
    this.textures.set(id, {
      texture,
      external: true,
      width: width ?? texture?.image?.width ?? this.width ?? 0,
      height: height ?? texture?.image?.height ?? this.height ?? 0,
    })
  }

  // Upload an HTML video/image/canvas/ImageBitmap as a sampleable input (Canvas2D
  // overlays like fibers/scratches/strayHair, media effects, NoisemakerPass non-RT
  // sources). We do the raw-GL upload OURSELVES — byte-identical to the reference
  // webgl2 backend (LINEAR/CLAMP, UNPACK_FLIP_Y, and crucially the DEFAULT
  // UNPACK_COLORSPACE_CONVERSION = BROWSER_DEFAULT) — instead of letting three upload
  // it, because three forces UNPACK_COLORSPACE_CONVERSION = NONE for NoColorSpace
  // textures, which shifts canvas pixels and breaks parity on the overlay effects. The
  // raw handle is injected into a THREE.Texture (version 0 ⇒ three never re-uploads,
  // just binds our handle).
  updateTextureFromSource(id, source, opts = {}) {
    const gl = this.gl
    const flipY = opts.flipY !== false
    const width = source.videoWidth || source.naturalWidth || source.width || 1
    const height = source.videoHeight || source.naturalHeight || source.height || 1
    let info = this.textures.get(id)
    if (!info?.externalGL || info.width !== width || info.height !== height) {
      if (info?.externalGL) gl.deleteTexture(info.externalGL)
      const handle = gl.createTexture()
      const tex = new THREE.Texture() // version stays 0 → three binds our handle, never uploads
      const props = this.renderer.properties.get(tex)
      props.__webglTexture = handle
      props.__webglInit = true
      info = { texture: tex, external: true, externalGL: handle, width, height }
      this.textures.set(id, info)
    }
    gl.bindTexture(gl.TEXTURE_2D, info.externalGL)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.renderer.resetState() // re-sync three's texture-unit cache after our raw binds
    const props = this.renderer.properties.get(info.texture)
    props.__webglTexture = info.externalGL
    props.__webglInit = true
    return { width, height }
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

  // --- mesh (OBJ) upload + triangle rasterization (meshLoader / meshRender) ---

  // Upload one mesh-surface texture as a raw-GL RGBA float texture (NEAREST/CLAMP), wrapped
  // in a THREE.Texture by injecting the GL handle — mirrors the reference webgl2
  // _uploadMeshTexture so the VS's texelFetch sampling is byte-identical.
  _uploadMeshTexture(texId, data, width, height, internalFormat, formatName) {
    const gl = this.gl
    let info = this.textures.get(texId)
    if (!info?.externalGL || info.width !== width || info.height !== height) {
      if (info?.externalGL) gl.deleteTexture(info.externalGL)
      const handle = gl.createTexture()
      const tex = new THREE.Texture()
      const props = this.renderer.properties.get(tex)
      props.__webglTexture = handle
      props.__webglInit = true
      info = { texture: tex, external: true, externalGL: handle, width, height, format: formatName }
      this.textures.set(texId, info)
    }
    gl.bindTexture(gl.TEXTURE_2D, info.externalGL)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, gl.FLOAT, data)
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.renderer.resetState()
    const props = this.renderer.properties.get(info.texture)
    props.__webglTexture = info.externalGL
    props.__webglInit = true
  }

  // Populate global_<meshId>_{positions,normals,uvs} from parsed OBJ data (positions/normals
  // RGBA32F, uvs RGBA16F) — mirrors the reference webgl2 uploadMeshData.
  uploadMeshData(meshId, positionData, normalData, uvData, width, height, vertexCount) {
    const gl = this.gl
    this._uploadMeshTexture(`global_${meshId}_positions`, positionData, width, height, gl.RGBA32F, 'rgba32f')
    this._uploadMeshTexture(`global_${meshId}_normals`, normalData, width, height, gl.RGBA32F, 'rgba32f')
    this._uploadMeshTexture(`global_${meshId}_uvs`, uvData, width, height, gl.RGBA16F, 'rgba16f')
    return { success: true, vertexCount }
  }

  // Look up a (possibly chain-scoped / externally-uploaded) texture's info for sizing.
  resolveMeshTexInfo(texId, state) {
    let info = this.textures.get(texId)
    if (info) return info
    const unscoped = texId.replace(/_chain_\d+$/, '')
    if (unscoped !== texId && (info = this.textures.get(unscoped))) return info
    const g = this.parseGlobalName(texId)
    if (g && state.surfaces?.[g]) return state.surfaces[g]
    return null
  }

  // Triangle count = mesh position texture w*h (reference: meshPositions || inputTex).
  resolveTriangleCount(pass, state) {
    const id = pass.inputs?.meshPositions || pass.inputs?.inputTex
    const tex = id ? this.resolveMeshTexInfo(id, state) : null
    if (tex?.width && tex?.height) return (tex.width * tex.height) | 0
    return (Number(pass.count) | 0) || 0
  }

  // Attach a cached DEPTH_COMPONENT24 renderbuffer to three's FBO for `rt` (three RTs are
  // created depthBuffer:false). Mirrors the reference webgl2 ensureDepthBuffer.
  ensureMeshDepth(rt) {
    const gl = this.gl
    const fbo = this.renderer.properties.get(rt).__webglFramebuffer
    let rec = this._meshDepth?.get(fbo)
    if (!rec) {
      rec = { buffer: gl.createRenderbuffer(), width: 0, height: 0 }
      ;(this._meshDepth ||= new Map()).set(fbo, rec)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    if (rec.width !== rt.width || rec.height !== rt.height) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, rec.buffer)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, rt.width, rt.height)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
      rec.width = rt.width
      rec.height = rt.height
    }
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rec.buffer)
    return fbo
  }

  // meshRender 'render' pass: rasterize triangles whose vertices the VS (render.vert) fetches
  // from the mesh textures by gl_VertexID. 3D state mirrors the reference webgl2 triangles
  // path — depth test LESS, back-face cull (CCW front), depth cleared per pass; color was
  // already written by the preceding 'clear' pass (so we clear depth only).
  executeTriangles(pass, state, material) {
    const gl = this.gl
    const count = this.resolveTriangleCount(pass, state)
    if (!count) return
    const target = this.resolveOutputTarget(pass, state)
    let geo = this._triGeoCache?.get(count)
    if (!geo) {
      geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
      ;(this._triGeoCache ||= new Map()).set(count, geo)
    }
    material.depthTest = true
    material.depthWrite = true
    material.depthFunc = THREE.LessDepth // gl.LESS
    material.side = THREE.FrontSide // cull BACK (three frontFace is CCW)
    const mesh = (this._triMesh ||= new THREE.Mesh(geo, material))
    mesh.geometry = geo
    mesh.material = material
    mesh.frustumCulled = false
    const scene = (this._triScene ||= new THREE.Scene())
    scene.clear()
    scene.add(mesh)
    this.renderer.setRenderTarget(target)
    if (target) this.ensureMeshDepth(target)
    gl.depthMask(true)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    this.renderer.render(scene, this.camera)
    if (target) {
      const fbo = this.renderer.properties.get(target).__webglFramebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null)
    }
    this.renderer.setRenderTarget(null)
    this.renderer.resetState()
  }

  destroy() {
    for (const id of Array.from(this.textures.keys())) this.destroyTexture(id)
    for (const { material } of this.programs.values()) material?.dispose?.()
    this.programs.clear()
    this.geometry?.dispose?.()
    this.presentMaterial?.dispose?.()
  }
}
