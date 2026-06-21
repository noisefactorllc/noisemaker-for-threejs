/**
 * noisemaker-three public API.
 *
 * v1 surface: NoisemakerCanvas (standalone renderer). NoisemakerTexture and
 * NoisemakerPass (EffectComposer) land in Phase 6. compileGraph is re-exported for
 * advanced/offline use.
 */
export { NoisemakerCanvas } from './integration/canvas.js'
export { ThreeBackend } from './backend/three-backend.js'
export { createThreePipeline } from './runtime/create-three-pipeline.js'
export { compileGraph } from './vendor/noisemaker/shaders/src/runtime/compiler.js'

export const VERSION = '0.0.1'
