/**
 * Node/fs effect loader (dev + tests).
 *
 * Dynamic-imports each vendored definition.js and reads its GLSL/WGSL from disk by
 * the `program -> glsl/<program>.{glsl|vert|frag}` convention, then registers via the
 * env-agnostic registerLoadedEffect. The browser candidate path uses a generated
 * bundle instead (Task 2.3), but registration is shared.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerLoadedEffect } from './loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EFFECTS_ROOT = path.resolve(__dirname, '../vendor/noisemaker/shaders/effects')

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
}

/**
 * @param {string[]} ids  effect ids like "synth/solid"
 */
export async function registerEffectsNode(ids) {
  for (const id of ids) {
    const [namespace, name] = id.split('/')
    const dir = path.join(EFFECTS_ROOT, namespace, name)
    const defPath = path.join(dir, 'definition.js')
    if (!fs.existsSync(defPath)) throw new Error(`effect not found: ${id} (${defPath})`)

    const mod = await import(pathToFileURL(defPath).href)
    // Most definitions `export default new Effect(...)`; a few export the class.
    const def = mod.default
    const instance = typeof def === 'function' ? new def() : def

    const shaders = {}
    for (const pass of instance.passes || []) {
      const prog = pass.program
      if (!prog || shaders[prog]) continue
      const bucket = {}
      const glsl = readIfExists(path.join(dir, 'glsl', `${prog}.glsl`))
      const vertex = readIfExists(path.join(dir, 'glsl', `${prog}.vert`))
      const fragment = readIfExists(path.join(dir, 'glsl', `${prog}.frag`))
      const wgsl = readIfExists(path.join(dir, 'wgsl', `${prog}.wgsl`))
      if (glsl) bucket.glsl = glsl
      if (vertex) bucket.vertex = vertex
      if (fragment) bucket.fragment = fragment
      if (wgsl) bucket.wgsl = wgsl
      shaders[prog] = bucket
    }
    await registerLoadedEffect(namespace, name, instance, shaders)
  }
}
