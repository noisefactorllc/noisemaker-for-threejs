/**
 * NoisemakerPass — run a DSL program as a three.js EffectComposer post-processing pass.
 *
 * Completes the integration trio (NoisemakerCanvas, NoisemakerTexture, NoisemakerPass),
 * all sharing the caller's WebGLRenderer.
 *
 * Two modes, decided by the program:
 *  - Filter:     the program samples the incoming scene. Wire it with the `media` effect
 *                (`media().<effects>.write(o0)`); the composer's readBuffer is bound to
 *                media's external `imageTex` input each frame (auto-detected `*_step_N`).
 *  - Generative: a self-contained program (`noise().bloom().write(o0)`) ignores the scene
 *                and renders over it. No source binding needed.
 *
 * The program runs offscreen (presentToScreen:false) and its result is blitted into the
 * composer's writeBuffer (or the screen when `renderToScreen`).
 */
import { compileGraph, loadEffectsForDsl } from '../engine-browser.js'
import { createThreePipeline } from '../runtime/create-three-pipeline.js'

// Implements three's Pass interface by duck-typing (EffectComposer reads
// enabled/needsSwap/clear/renderToScreen and calls setSize/render/dispose — it never
// does `instanceof Pass`). Avoiding the `three/addons` import keeps this resolvable in
// any environment (browser importmap, bundler, Node) with no extra map entry.
export class NoisemakerPass {
  constructor(renderer, opts = {}) {
    this.renderer = renderer
    // three Pass interface fields.
    this.enabled = true
    this.clear = false
    this.renderToScreen = false
    this.width = opts.width ?? 256
    this.height = opts.height ?? 256
    // Seconds for normalized time to advance 0->1 (animated programs). EffectComposer
    // hands each pass deltaTime; we accumulate it. Set `.time` to drive it manually.
    this.loopDuration = opts.loopDuration ?? 4
    this.time = opts.time ?? null
    // Which external input id(s) the scene binds to. null = auto-detect media `*_step_N`.
    this.sourceIds = opts.sourceId ? [opts.sourceId] : null
    this.pipeline = null
    this.graph = null
    this._elapsed = 0
    this.needsSwap = true
  }

  async compile(dsl) {
    await loadEffectsForDsl(dsl)
    this.graph = compileGraph(dsl)
    if (!this.sourceIds) this.sourceIds = NoisemakerPass.detectSourceIds(this.graph)
    this.pipeline = await createThreePipeline(this.graph, {
      renderer: this.renderer,
      width: this.width,
      height: this.height,
      presentToScreen: false,
    })
    return this.graph
  }

  // External-source inputs are wired by the expander as `<externalTexture>_step_<N>`
  // (e.g. media's `imageTex_step_0`). Those are the ids the host must bind each frame.
  static detectSourceIds(graph) {
    const ids = new Set()
    for (const pass of graph?.passes || []) {
      for (const texId of Object.values(pass.inputs || {})) {
        if (typeof texId === 'string' && /_step_\d+$/.test(texId)) ids.add(texId)
      }
    }
    return [...ids]
  }

  setSize(width, height) {
    this.width = width
    this.height = height
    if (this.pipeline) this.pipeline.resize(width, height)
  }

  render(renderer, writeBuffer, readBuffer, deltaTime = 0 /* maskActive */) {
    if (!this.pipeline) return
    // Bind the incoming scene as the program's external source(s) — a no-op for
    // generative programs (sourceIds empty).
    if (readBuffer?.texture && this.sourceIds.length) {
      for (const id of this.sourceIds) {
        this.pipeline.backend.setExternalTexture(id, readBuffer.texture, readBuffer.width, readBuffer.height)
      }
    }
    this._elapsed += deltaTime
    const t =
      this.time != null ? this.time : this.loopDuration > 0 ? (this._elapsed / this.loopDuration) % 1 : 0
    this.pipeline.render(t)
    const out = this.pipeline.backend.getPresentedTexture()
    this.pipeline.backend.blitToTarget(out, this.renderToScreen ? null : writeBuffer)
  }

  dispose() {
    this.pipeline?.backend?.destroy?.()
  }
}
