/**
 * Browser effect loader (served over http): dynamic-import each vendored
 * definition.js and fetch its GLSL by the `program -> glsl/<program>.{glsl|vert|frag}`
 * convention, then register via the shared registerLoadedEffect. Mirrors loader-node.js
 * but uses fetch/import.meta.url instead of fs.
 */
import { registerLoadedEffect } from './loader.js'

const EFFECTS_BASE = new URL('../vendor/noisemaker/shaders/effects/', import.meta.url)

async function fetchText(url) {
  const r = await fetch(url)
  return r.ok ? await r.text() : null
}

export async function registerEffectsBrowser(ids) {
  for (const id of ids) {
    const [namespace, name] = id.split('/')
    const dir = new URL(`${namespace}/${name}/`, EFFECTS_BASE)
    const mod = await import(new URL('definition.js', dir).href)
    const def = mod.default
    const instance = typeof def === 'function' ? new def() : def

    const shaders = {}
    for (const pass of instance.passes || []) {
      const prog = pass.program
      if (!prog || shaders[prog]) continue
      const bucket = {}
      // Prefer combined glsl/<prog>.glsl; fall back to a .vert/.frag pair (points).
      const glsl = await fetchText(new URL(`glsl/${prog}.glsl`, dir))
      if (glsl) {
        bucket.glsl = glsl
      } else {
        const vertex = await fetchText(new URL(`glsl/${prog}.vert`, dir))
        const fragment = await fetchText(new URL(`glsl/${prog}.frag`, dir))
        if (vertex) bucket.vertex = vertex
        if (fragment) bucket.fragment = fragment
      }
      shaders[prog] = bucket
    }
    await registerLoadedEffect(namespace, name, instance, shaders)
  }
}
