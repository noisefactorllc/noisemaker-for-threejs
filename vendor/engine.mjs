// engine.mjs — load the FETCHED published Noisemaker engine in Node (build-time / tooling).
//
// The engine bundle + per-effect mini-bundles are fetched from shaders.noisedeck.app by
// vendor/fetch.sh into vendor/noisemaker/ (GITIGNORED — never committed, like node_modules).
// This loader + the fetch script are the only committed pieces. The bundle is browser-oriented
// (defines a custom element at module scope), so Node needs a tiny DOM shim before evaluating it.
// We then load the per-effect mini-bundles exactly as production does (pre-fetch each effect),
// registering every one — each carries its GLSL inline, so the compiled graph already has shader
// source attached (no separate GLSL files to read).
//
// Browser code (the parity harness, integration, examples) imports the same core ESM directly
// and registers mini-bundles via src/effects/loader-browser.js (same registration logic).

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bootCore, registerEffectInstance, finalizeEnums } from '../src/effects/register-effect.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, 'noisemaker')
const CORE = join(VENDOR, 'noisemaker-shaders-core.esm.js')
const EFFECTS = join(VENDOR, 'effects')

// Minimal DOM shim: the bundle declares `class EffectSelect extends HTMLElement` (a UI custom
// element) at top level. We never use it from Node; the stubs just let the module evaluate.
function installDomShim () {
  globalThis.HTMLElement = globalThis.HTMLElement || class {}
  globalThis.customElements = globalThis.customElements || { define () {}, get () {}, whenDefined () { return Promise.resolve() } }
  globalThis.window = globalThis.window || globalThis
  globalThis.document = globalThis.document || {
    createElement () { return { style: {}, getContext () { return null }, appendChild () {}, setAttribute () {} } },
    createElementNS () { return { style: {} } },
    head: { appendChild () {} }, body: { appendChild () {} }
  }
}

let _booted = null

// Boot the engine: evaluate the core bundle, register every fetched effect mini-bundle, and
// return the low-level API the build tools use. Cached (the registry is process-global).
export async function bootEngine () {
  if (_booted) return _booted
  if (!existsSync(CORE)) {
    throw new Error(`Vendored engine missing at ${CORE}.\nRun: bash vendor/fetch.sh   (fetches the published engine from shaders.noisedeck.app)`)
  }
  installDomShim()

  const core = await import(pathToFileURL(CORE).href)
  await bootCore(core)

  const manifest = JSON.parse(readFileSync(join(EFFECTS, 'manifest.json'), 'utf8'))
  const allChoices = {}
  for (const id of Object.keys(manifest)) {
    const [ns, eff] = id.split('/')
    let mod
    try {
      mod = await import(pathToFileURL(join(EFFECTS, ns, `${eff}.js`)).href)
    } catch (err) {
      process.stderr.write(`[engine] skip ${id}: ${err?.message || err}\n`)
      continue
    }
    await registerEffectInstance(core, ns, eff, mod.default, allChoices)
  }
  await finalizeEnums(core, allChoices)

  _booted = {
    core,
    compileGraph: core.compileGraph,
    Pipeline: core.Pipeline,
    Backend: core.Backend,
    WebGL2Backend: core.WebGL2Backend,
    Effect: core.Effect,
    getEffect: core.getEffect,
  }
  return _booted
}
