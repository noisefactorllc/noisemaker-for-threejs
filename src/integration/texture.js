/**
 * NoisemakerTexture — run a DSL program into an offscreen render target exposed as a
 * stable THREE.Texture, for use on materials / scene.background / env sources.
 *
 * Shares the caller's WebGLRenderer (no second GL context, no per-frame CPU upload).
 * Renders the noisemaker pipeline offscreen (presentToScreen:false) and blits the
 * current render surface into a STABLE output target each update, so consumers can set
 * `material.map = nmTex.texture` once and it stays valid across ping-pong frames.
 */
import * as THREE from 'three'
import { compileGraph } from '../vendor/noisemaker/shaders/src/runtime/compiler.js'
import { createThreePipeline } from '../runtime/create-three-pipeline.js'
import { extractEffectIds } from '../effects/extract-effects.js'
import { registerEffectsBrowser } from '../effects/loader-browser.js'

export class NoisemakerTexture {
  constructor(renderer, opts = {}) {
    this.renderer = renderer
    this.width = opts.width ?? 256
    this.height = opts.height ?? 256
    this.pipeline = null
    // Stable output the pipeline result is blitted into each frame.
    this.outputRT = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    })
    this.outputRT.texture.colorSpace = THREE.NoColorSpace
  }

  async compile(dsl) {
    await registerEffectsBrowser(extractEffectIds(dsl))
    const graph = compileGraph(dsl)
    this.pipeline = await createThreePipeline(graph, {
      renderer: this.renderer,
      width: this.width,
      height: this.height,
      presentToScreen: false,
    })
    return graph
  }

  /** Advance one frame at normalized time t (0..1) and refresh the output texture. */
  update(t = 0) {
    this.pipeline.render(t)
    const src = this.pipeline.backend.getPresentedTexture()
    if (src) this.pipeline.backend.blitToTarget(src, this.outputRT)
  }

  /** Stable THREE.Texture holding the latest frame. */
  get texture() {
    return this.outputRT.texture
  }

  /** Read back the output texture as linear float (for parity verification). */
  readPixels() {
    const gl = this.renderer.getContext()
    this.renderer.setRenderTarget(this.outputRT)
    const data = new Float32Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data)
    this.renderer.setRenderTarget(null)
    return { width: this.width, height: this.height, data }
  }

  dispose() {
    this.outputRT.dispose()
    this.pipeline?.backend?.destroy?.()
  }
}
