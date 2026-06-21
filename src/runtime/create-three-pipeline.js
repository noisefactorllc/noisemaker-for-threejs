/**
 * Construct a reused Pipeline driven by ThreeBackend.
 *
 * Mirrors the vendored runtime/compiler.js `createPipeline`/`createRuntime` init
 * sequence, but injects ThreeBackend instead of selecting WebGL2/WebGPU. Pipeline
 * does the rest (program compilation, texture/surface allocation) via the backend
 * interface — see runtime/pipeline.js init().
 */
import { Pipeline } from '../vendor/noisemaker/shaders/src/runtime/pipeline.js'
import { ThreeBackend } from '../backend/three-backend.js'

export async function createThreePipeline(graph, { renderer, width = 800, height = 600, presentToScreen = true }) {
  const backend = new ThreeBackend(renderer, { presentToScreen })
  const pipeline = new Pipeline(graph, backend)
  await pipeline.init(width, height)
  return pipeline
}
