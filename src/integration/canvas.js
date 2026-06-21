/**
 * NoisemakerCanvas — standalone full-screen renderer (the primary parity vehicle).
 *
 * Owns a THREE.WebGLRenderer bound to a canvas, with color management disabled so
 * output stays linear (parity requirement). compile(dsl) registers the needed
 * effects, runs the reused compileGraph, and builds a Pipeline on ThreeBackend.
 */
import * as THREE from 'three'
import { compileGraph } from '../vendor/noisemaker/shaders/src/runtime/compiler.js'
import { createThreePipeline } from '../runtime/create-three-pipeline.js'
import { extractEffectIds } from '../effects/extract-effects.js'
import { registerEffectsBrowser } from '../effects/loader-browser.js'

export class NoisemakerCanvas {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.width = opts.width ?? canvas.width ?? 256
    this.height = opts.height ?? canvas.height ?? 256
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.width, this.height, false)
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.autoClear = false
    this.pipeline = null
  }

  async compile(dsl) {
    await registerEffectsBrowser(extractEffectIds(dsl))
    const graph = compileGraph(dsl)
    this.pipeline = await createThreePipeline(graph, {
      renderer: this.renderer,
      width: this.width,
      height: this.height,
    })
    return graph
  }

  /** Render a single frame at normalized time t (0..1). */
  renderFrame(t = 0) {
    this.pipeline.render(t)
  }

  /** Render `frames` deterministic frames at a pinned time (matches golden settle=8). */
  renderFrames(t = 0.25, frames = 8) {
    for (let i = 0; i < frames; i++) this.pipeline.render(t)
  }

  /** Read back the presented render surface as linear float {width,height,data}. */
  readPixels() {
    return this.pipeline.backend.readPixels()
  }

  get backend() {
    return this.pipeline?.backend
  }

  dispose() {
    this.pipeline?.dispose?.()
    this.pipeline?.backend?.destroy?.()
    this.renderer.dispose()
  }
}
