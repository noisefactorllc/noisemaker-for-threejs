/**
 * Environment-agnostic effect registration.
 *
 * Ports the reference CanvasRenderer.registerEffectWithRuntime + registerStarterOpForEffect
 * (the renderer layer we are replacing): attach loaded shader sources to the Effect
 * instance, register it under every lookup key, register its operator + param/effect
 * aliases + enum choices, and mark generators as starter ops. Source loading is
 * env-specific (loader-node.js for Node/fs; a generated bundle for the browser) — this
 * module only does registration, given an already-loaded `shaders` bucket.
 */
import { registerEffect } from '../vendor/noisemaker/shaders/src/runtime/registry.js'
import { registerOp } from '../vendor/noisemaker/shaders/src/lang/ops.js'
import { registerParamAliases } from '../vendor/noisemaker/shaders/src/lang/paramAliases.js'
import { registerEffectAlias } from '../vendor/noisemaker/shaders/src/lang/effectAliases.js'
import { registerStarterOps } from '../vendor/noisemaker/shaders/src/lang/validator.js'
import { mergeIntoEnums } from '../vendor/noisemaker/shaders/src/lang/enums.js'
import { stdEnums } from '../vendor/noisemaker/shaders/src/lang/std_enums.js'

let enumsInitialized = false

/** Initialize standard enums once (idempotent). */
export async function initEnums() {
  if (enumsInitialized) return
  await mergeIntoEnums(stdEnums)
  enumsInitialized = true
}

// --- pure helpers ported verbatim from canvas.js ---
function isValidIdentifier(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

function sanitizeEnumName(name) {
  let result = name.replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/\s+/g, '')
  result = result.replace(/[^a-zA-Z0-9_]/g, '')
  if (!isValidIdentifier(result)) return null
  return result
}

function isStarterEffect(instance) {
  const passes = instance.passes || []
  if (passes.length === 0) return true
  const pipelineInputs = new Set([
    'inputTex', 'inputTex3d',
    'o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7',
  ])
  return !passes.some(
    (pass) => pass.inputs && Object.values(pass.inputs).some((val) => pipelineInputs.has(val))
  )
}

/**
 * @param {string} namespace  e.g. "synth"
 * @param {string} name       effect dir name, e.g. "solid"
 * @param {object} instance   the `new Effect({...})` default export from definition.js
 * @param {object} shaders    { [program]: { glsl?, vertex?, fragment?, wgsl? } }
 */
export async function registerLoadedEffect(namespace, name, instance, shaders) {
  await initEnums()
  instance.shaders = shaders

  // 17 effect definitions omit an explicit `namespace:` field and rely on the
  // reference inferring it from the directory at registration. Match that.
  if (!instance.namespace) instance.namespace = namespace

  // Register under all four lookup keys the reference uses.
  if (instance.func) {
    registerEffect(instance.func, instance)
    registerEffect(`${namespace}.${instance.func}`, instance)
  }
  registerEffect(`${namespace}/${name}`, instance)
  registerEffect(`${namespace}.${name}`, instance)

  if (!instance.func) return

  // Build the operator spec from globals; collect enum choices to merge.
  const choicesToRegister = {}
  const args = Object.entries(instance.globals || {}).map(([key, spec]) => {
    let enumPath = spec.enum || spec.enumPath
    if (spec.choices && !enumPath) {
      enumPath = `${namespace}.${instance.func}.${key}`
      choicesToRegister[namespace] ??= {}
      choicesToRegister[namespace][instance.func] ??= {}
      choicesToRegister[namespace][instance.func][key] = {}
      for (const [cname, val] of Object.entries(spec.choices)) {
        if (cname.endsWith(':')) continue
        choicesToRegister[namespace][instance.func][key][cname] = { type: 'Number', value: val }
        const sanitized = sanitizeEnumName(cname)
        if (sanitized && sanitized !== cname) {
          choicesToRegister[namespace][instance.func][key][sanitized] = { type: 'Number', value: val }
        }
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

  registerOp(`${namespace}.${instance.func}`, { name: instance.func, args })

  if (instance.paramAliases) {
    registerParamAliases(`${namespace}.${instance.func}`, instance.paramAliases)
  }
  if (instance.hidden && instance.deprecatedBy) {
    registerEffectAlias(`${namespace}.${instance.func}`, instance.deprecatedBy)
  }
  if (Object.keys(choicesToRegister).length > 0) {
    await mergeIntoEnums(choicesToRegister)
  }
  // Some effects ship their own enum tables (instance.enums) that must be merged too.
  if (instance.enums) {
    await mergeIntoEnums(instance.enums)
  }

  // Generators that can begin a chain must be registered as starter ops.
  if (isStarterEffect(instance)) {
    registerStarterOps([instance.func, `${namespace}.${instance.func}`])
  }
}
