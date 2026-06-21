/**
 * noisemaker-three public API.
 *
 * Integration surface: NoisemakerCanvas (standalone renderer), NoisemakerTexture
 * (program-as-THREE.Texture), NoisemakerPass (EffectComposer post-processing pass).
 * compileGraph is re-exported for advanced/offline use.
 */
export { NoisemakerCanvas } from './integration/canvas.js'
export { NoisemakerTexture } from './integration/texture.js'
export { NoisemakerPass } from './integration/pass.js'
export { ThreeBackend } from './backend/three-backend.js'
export { createThreePipeline } from './runtime/create-three-pipeline.js'
export { compileGraph } from './engine-browser.js'

export const VERSION = '0.0.1'
