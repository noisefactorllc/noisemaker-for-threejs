// engine-browser.js — the published Noisemaker engine, for the browser.
//
// Statically imports the core ESM bundle (fetched from the CDN by vendor/fetch.sh into the
// git-ignored vendor/noisemaker/; served locally for parity, bundled for shipping). Re-exports
// the low-level pieces the adapter injects into — `Backend` (ThreeBackend extends it), `Pipeline`,
// `compileGraph`, `WebGL2Backend` (the golden) — and loads effect mini-bundles on demand using the
// same registration as the Node loader (src/effects/register-effect.js), so the two never drift.
//
// ES modules are singletons: this `core` instance and any direct core import in a harness page
// resolve to the same URL, so the effect registry is shared.
import * as core from '../vendor/noisemaker/noisemaker-shaders-core.esm.js'
import { bootCore, registerEffectInstance, finalizeEnums } from './effects/register-effect.js'

export const { Backend, Pipeline, compileGraph, WebGL2Backend, createPipeline, extractEffectNamesFromDsl } = core
export { core }

const EFFECTS_BASE = new URL('../vendor/noisemaker/effects/', import.meta.url)
let _booted = false
let _manifest = null
const _loaded = new Set()

async function ensureBooted () {
  if (_booted) return
  await bootCore(core)
  _booted = true
}

async function getManifest () {
  if (!_manifest) {
    const res = await fetch(new URL('manifest.json', EFFECTS_BASE).href)
    _manifest = res.ok ? await res.json() : {}
  }
  return _manifest
}

// Register exactly the effects a DSL program needs (by mini-bundle import). Idempotent.
export async function loadEffectsForDsl (dsl) {
  const ids = extractEffectNamesFromDsl(dsl, await getManifest()).map((e) => e.effectId)
  await loadEffects(ids)
}

export async function loadEffects (ids) {
  await ensureBooted()
  const allChoices = {}
  for (const id of ids) {
    if (_loaded.has(id)) continue
    const [ns, eff] = id.split('/')
    try {
      const mod = await import(new URL(`${ns}/${eff}.js`, EFFECTS_BASE).href)
      await registerEffectInstance(core, ns, eff, mod.default, allChoices)
      _loaded.add(id)
    } catch (err) {
      console.error(`[engine-browser] failed to load effect ${id}:`, err?.message || err)
    }
  }
  await finalizeEnums(core, allChoices)
}
