/**
 * NoisemakerCanvas — standalone full-screen renderer (the primary parity vehicle).
 *
 * Owns a THREE.WebGLRenderer bound to a canvas, with color management disabled so
 * output stays linear (parity requirement). compile(dsl) registers the needed
 * effects, runs the reused compileGraph, and builds a Pipeline on ThreeBackend.
 *
 * Context loss recovery follows the upstream CanvasRenderer contract (see
 * noisemaker shaders/src/renderer/canvas.js): after a lost WebGL context the
 * renderer presents on a fresh canvas in the old canvas's place, whether the
 * browser restores the context or not, because a canvas after a GPU process
 * exit cannot be read back as an image. compile() on an unrestored context
 * moves to a fresh canvas too, waiting while the browser refuses new contexts.
 * A canvas disposed intentionally never restarts after a context loss; an
 * explicit compile() revives it, and a failed revive keeps it disposed.
 */
import * as THREE from 'three'
import { compileGraph, loadEffectsForDsl, registerPortableEffectInstance } from '../engine-browser.js'
import { createThreePipeline } from '../runtime/create-three-pipeline.js'

// How long a lost WebGL context waits for the browser's restore event before
// the renderer moves to a fresh canvas. A browser that restores does so well
// within this.
const CONTEXT_RESTORE_WAIT_MS = 3000
// After GPU process exits that it blames on a page, Chrome refuses the page new
// WebGL contexts for a while. Recovery asks again at this interval, up to the limit.
const CONTEXT_RETRY_MS = 1000
const CONTEXT_RECOVERY_LIMIT_MS = 120000

export class NoisemakerCanvas {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.width = opts.width ?? canvas.width ?? 256
    this.height = opts.height ?? canvas.height ?? 256
    this.renderer = this._createRenderer(canvas)
    this.pipeline = null
    this._currentDsl = null
    this._isContextLost = false
    this._contextLostBeforeSecondFrame = false
    // An intentionally disposed canvas never restarts after a context loss.
    this._isDisposed = false
    this._lifecycleGeneration = 0
    this._frameCount = 0
    this._contextRecoveryTimer = null
    this._compileQueue = null
    this._onContextLost = opts.onContextLost
    this._onContextRestored = opts.onContextRestored
    this._attachContextLossHandlers(canvas)
  }

  /** @private Create the THREE.WebGLRenderer with the port's pinned settings. */
  _createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(this.width, this.height, false)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.autoClear = false
    return renderer
  }

  /** @private Attach the context loss/restore handlers to a canvas. */
  _attachContextLossHandlers(canvas) {
    this._boundContextLost = (event) => {
      event.preventDefault() // Signal the browser we will handle restore
      this._isContextLost = true
      // A disposed canvas stays dead: the late loss event must not schedule a
      // rebuild. It still marks the loss, so a later explicit compile() recovers.
      if (this._isDisposed) return
      this._handleContextLost()
    }
    this._boundContextRestored = () => {
      this._handleContextRestored()
    }
    canvas.addEventListener('webglcontextlost', this._boundContextLost)
    canvas.addEventListener('webglcontextrestored', this._boundContextRestored)
  }

  /** @private Handle a lost WebGL context: stop, notify the host, and schedule recovery. */
  _handleContextLost() {
    // A context lost while the program drew its first frames may have been
    // stalled by those very frames; rebuilding it could stall the GPU again.
    // The next compile() builds.
    this._contextLostBeforeSecondFrame = this._frameCount < 2 && Boolean(this.pipeline)
    console.warn('[NoisemakerCanvas] WebGL context lost')
    if (this._onContextLost) {
      this._onContextLost()
    }
    this._scheduleContextRecovery()
  }

  /**
   * @private Whether to rebuild the current program after a context loss.
   * Not when the context was lost while it drew its first frames: it may have
   * stalled the GPU. The next compile() builds.
   */
  _rebuildsAfterContextLoss() {
    if (!this._currentDsl) return false
    if (this._contextLostBeforeSecondFrame) {
      console.warn('[NoisemakerCanvas] Not rebuilding the program: the WebGL context was lost while it drew its first frames, so it may have stalled the GPU')
      return false
    }
    return true
  }

  /**
   * @private When the browser does not restore the lost context in time,
   * rebuild the current program on a fresh canvas (see compile()).
   */
  _scheduleContextRecovery() {
    this._clearContextRecovery()
    const canvas = this.canvas
    this._contextRecoveryTimer = setTimeout(() => {
      this._contextRecoveryTimer = null
      if (!this._isContextLost || canvas !== this.canvas) return
      this._queueCompile(() => this._recoverAfterContextLoss()).catch((error) => {
        console.error('[NoisemakerCanvas] Failed to rebuild after context loss:', error)
      })
    }, CONTEXT_RESTORE_WAIT_MS)
  }

  /** @private */
  _clearContextRecovery() {
    if (this._contextRecoveryTimer !== null) {
      clearTimeout(this._contextRecoveryTimer)
      this._contextRecoveryTimer = null
    }
  }

  /**
   * @private Handle the browser's context restore event: recover onto a fresh
   * canvas in the old canvas's place and rebuild the program.
   */
  async _handleContextRestored() {
    if (this._isDisposed) return
    this._clearContextRecovery()
    if (!this._isContextLost) return
    console.log('[NoisemakerCanvas] WebGL context restored, rebuilding on a fresh canvas...')
    await this._queueCompile(() => this._recoverAfterContextLoss())
  }

  /**
   * @private Recover rendering after a context loss, restored by the browser
   * or not: present on a fresh canvas in the old canvas's place (hosts read
   * `canvas` afterwards), rebuild the program, and notify the host.
   */
  async _recoverAfterContextLoss() {
    if (this._isDisposed) return false
    if (!this._isContextLost) return false
    const rebuilds = this._rebuildsAfterContextLoss()
    if (rebuilds) {
      // _compile fires onContextRestored when it rebuilt on a fresh canvas.
      await this._compile(this._currentDsl)
    } else {
      await this._replaceLostCanvas()
      if (this._onContextRestored) {
        this._onContextRestored()
      }
    }
    return true
  }

  /** Serialize compiles and recoveries so they cannot mutate the same canvas concurrently. */
  _queueCompile(run) {
    const pending = this._compileQueue ? this._compileQueue.then(run, run) : run()
    this._compileQueue = pending.then(() => {}, () => {})
    return pending
  }

  compile(dsl) {
    // A compile queued before a dispose() must not run after it: the disposed
    // canvas stays dead until a later explicit compile() revives it.
    const generation = this._lifecycleGeneration
    return this._queueCompile(async () => {
      if (generation !== this._lifecycleGeneration) return null
      // An explicit compile revives a disposed canvas and re-enables its
      // context-loss recovery.
      const wasDisposed = this._isDisposed
      this._isDisposed = false
      try {
        if (wasDisposed && !this.canvas.getContext('webgl2')?.isContextLost()) {
          // A disposed renderer cannot build again; the canvas's live context
          // can. A lost context is replaced on a fresh canvas in _compile.
          this.renderer = this._createRenderer(this.canvas)
        }
        return await this._compile(dsl)
      } catch (error) {
        // A revive that fails leaves the canvas disposed: no pipeline was
        // built, and no automatic recovery may schedule itself.
        if (wasDisposed && !this.pipeline) {
          this._isDisposed = true
          this._clearContextRecovery()
        }
        throw error
      }
    })
  }

  async _compile(dsl) {
    // A dispose() during any of the awaits below makes this compile stale:
    // its result belongs to a disposed canvas and must not attach.
    const generation = this._lifecycleGeneration
    this._currentDsl = dsl
    const recovering = this._isContextLost
    let graph
    let pipeline
    try {
      // A lost context that the browser has not restored cannot compile;
      // build on a fresh canvas instead.
      if (recovering) {
        await this._replaceLostCanvas()
      }
      if (generation !== this._lifecycleGeneration) return null
      await loadEffectsForDsl(dsl)
      if (generation !== this._lifecycleGeneration) return null
      graph = compileGraph(dsl)
      pipeline = await createThreePipeline(graph, {
        renderer: this.renderer,
        width: this.width,
        height: this.height,
      })
    } catch (error) {
      // An error from a build the canvas was disposed during is the disposed
      // canvas's, not the caller's.
      if (generation !== this._lifecycleGeneration) return null
      throw error
    }
    if (generation !== this._lifecycleGeneration) {
      try {
        pipeline.dispose()
      } catch (error) {
        console.warn('Failed to dispose a stale NoisemakerCanvas pipeline', error)
      }
      return null
    }
    const previousPipeline = this.pipeline
    this.pipeline = pipeline
    if (previousPipeline && previousPipeline !== pipeline) {
      try {
        previousPipeline.dispose()
      } catch (error) {
        console.warn('Failed to dispose previous NoisemakerCanvas pipeline', error)
      }
    }
    if (recovering) {
      console.log('[NoisemakerCanvas] Pipeline rebuilt on a fresh canvas after an unrestored context loss')
      if (this._onContextRestored) {
        this._onContextRestored()
      }
    }
    return graph
  }

  /**
   * @private Move to a fresh canvas in place of one whose lost WebGL context
   * the browser has not restored, as upstream switchBackend() does, and wait
   * while the browser refuses the page new WebGL contexts.
   */
  async _replaceLostCanvas() {
    this._clearContextRecovery()
    const deadPipeline = this.pipeline
    const deadRenderer = this.renderer
    this.pipeline = null
    try {
      deadPipeline?.dispose?.()
    } catch (error) {
      console.warn('Failed to dispose context-lost pipeline', error)
    }
    this._swapCanvas()
    try {
      deadRenderer.dispose()
    } catch (error) {
      console.warn('Failed to dispose context-lost renderer', error)
    }

    // A fresh canvas normally takes a WebGL2 context at once; a browser that
    // blames the page for a GPU process exit refuses new contexts for a while.
    const deadline = performance.now() + CONTEXT_RECOVERY_LIMIT_MS
    while (!this.canvas.getContext('webgl2', { preserveDrawingBuffer: true })) {
      if (performance.now() >= deadline) {
        // Still without a context: the next compile() waits again.
        this._isContextLost = true
        throw new Error('The browser did not allow a new WebGL2 context after the context was lost')
      }
      await new Promise((resolve) => setTimeout(resolve, CONTEXT_RETRY_MS))
    }
    this.renderer = this._createRenderer(this.canvas)
    this._isContextLost = false
    return true
  }

  /**
   * @private Put a fresh copy of the canvas in its place inside its parent,
   * or, for a canvas outside the document, in its place as the renderer's
   * canvas. A canvas keeps the context type that it got first, and a context
   * the browser does not restore stays lost, so both need a new canvas element.
   */
  _swapCanvas() {
    const old = this.canvas
    // Detach the handlers first: the discarded canvas's late restore event can
    // never recover anything, and its listeners must not leak with it.
    old.removeEventListener('webglcontextlost', this._boundContextLost)
    old.removeEventListener('webglcontextrestored', this._boundContextRestored)
    const fresh = old.cloneNode(false)
    if (old.parentNode) {
      old.parentNode.replaceChild(fresh, old)
    }
    this.canvas = fresh
    this._attachContextLossHandlers(fresh)
  }

  /**
   * Register a raw Portable definition (Portable JSON + shaders[program].glsl/wgsl) into the
   * user.* namespace — the adapter equivalent of upstream CanvasRenderer.registerPortableEffect.
   * Validation-only surface: it checks registration inputs, not shader compilation or backend
   * support. Compile a program referencing `user.<func>` afterwards with compile().
   */
  registerPortableEffect(definition) {
    return registerPortableEffectInstance(definition)
  }

  addSink(sink) {
    if (!this.pipeline) {
      throw new Error('NoisemakerCanvas has no active pipeline; compile before adding a sink')
    }
    return this.pipeline.addSink(sink)
  }

  createFrameExportQueue(options = {}) {
    if (!this.pipeline) {
      throw new Error('NoisemakerCanvas has no active pipeline; compile before creating a frame export queue')
    }
    return this.pipeline.backend?.createFrameExportQueue?.(options) ?? null
  }

  /** @returns {boolean} Whether an active output sink has requested skipping the next frame. */
  shouldDeferRender() {
    return Boolean(this.pipeline?.shouldDeferRender?.())
  }

  /** Render a single frame at normalized time t (0..1). */
  renderFrame(t = 0, presentationTimestamp) {
    this.pipeline.render(t, presentationTimestamp)
    // Count a frame only after a successful draw: a thrown draw must not
    // consume the first-frame loss protection.
    this._frameCount++
  }

  /** Render `frames` deterministic frames at a pinned time (matches golden settle=8). */
  renderFrames(t = 0.25, frames = 8) {
    for (let i = 0; i < frames; i++) {
      this.pipeline.render(t)
      this._frameCount++
    }
  }

  /** Read back the presented render surface as linear float {width,height,data}. */
  readPixels() {
    return this.pipeline.backend.readPixels()
  }

  get backend() {
    return this.pipeline?.backend
  }

  dispose() {
    this._isDisposed = true
    this._lifecycleGeneration++
    this._clearContextRecovery()
    // The context-loss handlers stay attached: while disposed they only mark a
    // loss, and an explicit compile() that revives this canvas needs the mark
    // to recover on a fresh canvas.
    const pipeline = this.pipeline
    this.pipeline = null
    let firstError
    try {
      pipeline?.dispose?.()
    } catch (error) {
      firstError = error
    }
    try {
      this.renderer.dispose()
    } catch (error) {
      if (!firstError) firstError = error
    }
    if (firstError) throw firstError
  }
}
