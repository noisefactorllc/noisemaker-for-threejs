import * as core from '../vendor/noisemaker/noisemaker-shaders-reference.esm.js'
import { bootCore, registerEffectInstance, finalizeEnums } from '../src/effects/register-effect.js'

export { core }
export const { compileGraph, createPipeline } = core
const base = new URL('../vendor/noisemaker/effects/', import.meta.url)
const loaded = new Set()
let manifest
let booted = false

export async function loadEffectsForDsl(dsl) {
  if (!booted) { await bootCore(core); booted = true }
  if (!manifest) {
    const response = await fetch(new URL('manifest.json', base))
    if (!response.ok) throw new Error(`Reference manifest: HTTP ${response.status}`)
    manifest = await response.json()
  }
  const choices = {}
  for (const { effectId } of core.extractEffectNamesFromDsl(dsl, manifest)) {
    if (loaded.has(effectId)) continue
    const [namespace, name] = effectId.split('/')
    const { default: instance } = await import(new URL(`${effectId}.js`, base).href)
    await registerEffectInstance(core, namespace, name, instance, choices)
    loaded.add(effectId)
  }
  await finalizeEnums(core, choices)
}
