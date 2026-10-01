// register-effect.js — platform-neutral effect registration (no I/O, no DOM).
//
// Registers one effect mini-bundle instance into the engine's global registry, exactly as the
// reference canvas.js does at load time: 4 lookup aliases + op + starter flag + enums. Shared by
// the Node loader (vendor/engine.mjs) and the browser loader (src/engine-browser.js) so the two
// can never drift. Each mini-bundle instance carries its GLSL inline (instance.shaders), so nothing
// else needs attaching — the compiled graph is self-contained.
//
// `core` is the evaluated noisemaker-shaders-core ESM (registerEffect/registerOp/… exports).

// One-time engine boot: standard enums + starter ops (write/render/blend/…), before any effect.
export async function bootCore (core) {
  if (core.mergeIntoEnums && core.stdEnums) await core.mergeIntoEnums(core.stdEnums)
  if (core.registerStarterOps) core.registerStarterOps()
}

export async function registerEffectInstance (core, ns, eff, instance, allChoices) {
  if (!instance) return
  // Most effects export `new Effect({...})` (an instance); a few (media, meshLoader) export a
  // class `extends Effect` — instantiate those so .globals/.passes exist. The mini-bundle attaches
  // GLSL as a STATIC `.shaders` on the class (instance fields land on the instance, but the static
  // does not), so copy it onto the instance — else the compiled graph has no shader source
  // (ERR_PROGRAM_SPEC_MISSING).
  if (typeof instance === 'function') {
    const Cls = instance
    instance = new Cls()
    if (!instance.shaders && Cls.shaders) instance.shaders = Cls.shaders
  }
  if (!instance.namespace) instance.namespace = ns
  const func = instance.func || eff

  core.registerEffect(func, instance)
  core.registerEffect(`${ns}.${func}`, instance)
  core.registerEffect(`${ns}/${eff}`, instance)
  core.registerEffect(`${ns}.${eff}`, instance)

  const args = Object.entries(instance.globals || {}).map(([key, spec]) => {
    let enumPath = spec.enum || spec.enumPath
    if (spec.choices && !enumPath) {
      enumPath = `${ns}.${func}.${key}`
      allChoices[ns] = allChoices[ns] || {}
      allChoices[ns][func] = allChoices[ns][func] || {}
      allChoices[ns][func][key] = allChoices[ns][func][key] || {}
      for (const [nm, val] of Object.entries(spec.choices)) {
        if (typeof nm === 'string' && nm.endsWith(':')) continue
        allChoices[ns][func][key][nm] = { type: 'Number', value: val }
        const san = core.sanitizeEnumName ? core.sanitizeEnumName(nm) : nm
        if (san && san !== nm) allChoices[ns][func][key][san] = { type: 'Number', value: val }
      }
    }
    return {
      name: key,
      type: spec.type === 'vec4' ? 'color' : spec.type,
      default: spec.default,
      enum: enumPath,
      enumPath,
      min: spec.min,
      max: spec.max,
      uniform: spec.uniform,
      choices: spec.choices,
    }
  })
  // NOTE: param aliases (e.g. media backgroundColor->bgColor) need the reference's
  // registerParamAliases, which the published bundle does NOT export — so this adapter accepts
  // CANONICAL param names only (the names the noisedeck UI emits). Faithful for app-authored
  // programs; hand-authored alias names won't resolve. (Verified: the live corpus is unaffected.)
  if (core.registerOp) core.registerOp(`${ns}.${func}`, { name: func, args })

  const isStarter = !((instance.passes || []).some((p) =>
    p.inputs && Object.values(p.inputs).some((v) => ['inputTex', 'inputTex3d', 'src', 'o0', 'o1'].includes(v))))
  if (isStarter && core.registerStarterOps) core.registerStarterOps([`${ns}.${func}`])

  if (instance.enums && core.mergeIntoEnums) await core.mergeIntoEnums(instance.enums)
}

// Merge accumulated choice-enums once, after all effects are registered.
export async function finalizeEnums (core, allChoices) {
  if (core.mergeIntoEnums && Object.keys(allChoices).length) await core.mergeIntoEnums(allChoices)
}

// registerPortableEffect — port of upstream CanvasRenderer.registerPortableEffect
// (noisemaker cb22a05e, shaders/src/renderer/canvas.js). Registers a raw Portable definition
// (Portable JSON + already-loaded shaders[program].glsl/wgsl) into the user.* namespace with the
// same validation contract: DSL-identifier func, prototype-key poisoning guards, nonempty passes
// naming loaded programs, per-language shader completeness, globals/choices/paramAliases shapes,
// and duplicate-name rejection. Registration mirrors upstream registerEffectWithRuntime scoped to
// user.*: 4 lookup aliases (bare name restored/unregistered afterwards so a Portable effect never
// shadows an existing bare built-in), registerOp args from globals with choice-enum collection,
// starter inference over the full pipeline-input list with explicit override, and choice-enum
// merge. Like manifest mini-bundles, paramAliases are validated but NOT registered — the
// published bundle does not export registerParamAliases (see the NOTE above; canonical names only).
export async function registerPortableEffect (core, definition) {
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  const fail = (message) => { throw new Error(`Portable effect: ${message}`) }
  if (!isRecord(definition)) fail('expected a definition object')
  const { namespace, passes, shaders, globals, starter } = definition
  const func = definition.func ?? definition.name
  if (typeof func !== 'string' || !(core.isValidIdentifier ? core.isValidIdentifier(func) : /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(func))) {
    fail('func must be a DSL identifier')
  }
  // The shared operator/enum registries use object trees. JSON keys that control their
  // prototypes must never reach those registration paths.
  const reserved = [...Object.getOwnPropertyNames(Object.prototype), 'prototype']
  if (reserved.includes(func)) fail(`reserved func ${func}`)
  const pending = [definition]
  const visited = new Set()
  while (pending.length) {
    const value = pending.pop()
    if (!value || typeof value !== 'object' || visited.has(value)) continue
    visited.add(value)
    for (const [key, child] of Object.entries(value)) {
      if (reserved.includes(key)) fail(`reserved metadata key ${key}`)
      if (child && typeof child === 'object') pending.push(child)
    }
  }
  if (namespace !== undefined && namespace !== 'user') fail('namespace must be user')
  if (starter !== undefined && typeof starter !== 'boolean') fail('starter must be boolean')
  if (!Array.isArray(passes) || passes.length === 0) fail('passes must be a nonempty array')
  if (!isRecord(shaders)) fail('loaded shaders are required')
  const hasSource = (source) => typeof source === 'string' && source.trim().length > 0
  for (const pass of passes) {
    if (!isRecord(pass) || typeof pass.program !== 'string' || !pass.program) fail('each pass must name a program')
    for (const field of ['inputs', 'outputs']) {
      if (pass[field] !== undefined && (!isRecord(pass[field]) || Object.values(pass[field]).some((value) => !hasSource(value)))) {
        fail(`pass ${field} must map names to nonempty texture references`)
      }
    }
    const source = shaders[pass.program]
    if (!isRecord(source) || ![source.glsl, source.wgsl].some(hasSource)) {
      fail(`missing shader source for ${pass.program}`)
    }
  }
  for (const language of ['glsl', 'wgsl']) {
    if (passes.some((pass) => hasSource(shaders[pass.program][language]))) {
      for (const pass of passes) {
        if (!hasSource(shaders[pass.program][language])) fail(`missing ${language} shader source for ${pass.program}`)
      }
    }
  }
  if (globals !== undefined && (!isRecord(globals) || Object.values(globals).some((spec) => !isRecord(spec)))) {
    fail('globals must contain parameter objects')
  }
  for (const [key, spec] of Object.entries(globals || {})) {
    if (spec.choices !== undefined && (!isRecord(spec.choices) || Object.values(spec.choices).some((value) =>
      value !== null && (spec.type === 'string' ? typeof value !== 'string' : !Number.isFinite(value))))) {
      fail(`choices for ${key} must map names to ${spec.type === 'string' ? 'strings' : 'numbers'} or null`)
    }
  }
  if (definition.paramAliases !== undefined && (!isRecord(definition.paramAliases) ||
    Object.values(definition.paramAliases).some((target) => typeof target !== 'string' || !Object.hasOwn(globals || {}, target)))) {
    fail('paramAliases must map names to declared globals')
  }
  if (core.getEffect(`user.${func}`) || core.getEffect(`user/${func}`)) fail(`user.${func} is already registered`)

  const instance = new core.Effect({ ...definition, func, namespace: 'user' })
  instance.shaders = shaders
  const pipelineInputs = ['inputTex', 'inputTex3d', 'inputGeo', 'inputXyz', 'inputVel', 'inputRgba', 'src', 'o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']
  instance.starter = starter ?? !passes.some((pass) =>
    Object.values(pass.inputs || {}).some((input) => pipelineInputs.includes(input)))
  const effect = { namespace: 'user', name: func, instance }

  const allChoices = {}
  const args = Object.entries(instance.globals || {}).map(([key, spec]) => {
    let enumPath = spec.enum || spec.enumPath
    if (spec.choices && !enumPath) {
      enumPath = `user.${func}.${key}`
      allChoices.user = allChoices.user || {}
      allChoices.user[func] = allChoices.user[func] || {}
      allChoices.user[func][key] = allChoices.user[func][key] || {}
      for (const [nm, val] of Object.entries(spec.choices)) {
        if (typeof nm === 'string' && nm.endsWith(':')) continue
        allChoices.user[func][key][nm] = { type: 'Number', value: val }
        const san = core.sanitizeEnumName ? core.sanitizeEnumName(nm) : nm
        if (san && san !== nm) allChoices.user[func][key][san] = { type: 'Number', value: val }
      }
    }
    return {
      name: key,
      type: spec.type === 'vec4' ? 'color' : spec.type,
      default: spec.default,
      enum: enumPath,
      enumPath,
      min: spec.min,
      max: spec.max,
      uniform: spec.uniform,
      choices: spec.choices,
    }
  })

  // Portable effects belong to user.*; preserve a built-in's bare lookup.
  const previousBare = core.getEffect(func)
  try {
    core.registerEffect(func, instance)
    core.registerEffect(`user.${func}`, instance)
    core.registerEffect(`user/${func}`, instance)
    if (core.registerOp) core.registerOp(`user.${func}`, { name: func, args })
  } finally {
    if (previousBare === undefined) {
      if (core.unregisterEffect) core.unregisterEffect(func)
    } else {
      core.registerEffect(func, previousBare)
    }
  }
  if (core.mergeIntoEnums && Object.keys(allChoices).length) await core.mergeIntoEnums(allChoices)
  if (instance.starter && core.registerStarterOps) core.registerStarterOps([`user.${func}`])
  return effect
}
