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
