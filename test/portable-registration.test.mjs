import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'
import { registerPortableEffect } from '../src/effects/register-effect.js'

// Port of upstream shaders/tests/test_portable_registration.js (noisemaker cb22a05e) onto the
// adapter's platform-neutral registration surface (src/effects/register-effect.js), which mirrors
// upstream CanvasRenderer.registerPortableEffect against the PUBLISHED engine bundle. Skips
// cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()
const core = eng?.core

// core.isStarterEffect takes an effect wrapper ({instance}); the registry stores bare instances.
const isStarter = (name) => core.isStarterEffect({ instance: core.getEffect(name) })

function definition (func, overrides = {}) {
  return {
    namespace: 'user', name: func, func,
    globals: {},
    passes: [{ name: 'main', program: 'main', inputs: {}, outputs: { fragColor: 'outputTex' } }],
    shaders: { main: { glsl: '#version 300 es\nvoid main() {}' } },
    ...overrides
  }
}

test('Portable registration preserves the Effect lifecycle and definition fields', { skip }, async () => {
  const raw = definition('portableContract', {
    textures: { history: { width: 32, height: 32, format: 'rgba16f' } },
    passes: [{ name: 'main', program: 'main', type: 'compute', inputs: { previous: 'history' }, outputs: { fragColor: 'outputTex' } }],
    defaultProgram: 'search user\nportableContract().write(o0)\nrender(o0)'
  })
  const effect = await registerPortableEffect(core, raw)
  assert.ok(core.Effect && effect.instance instanceof core.Effect)
  assert.equal(core.getEffect('user.portableContract'), effect.instance)
  assert.equal(core.getEffect('user/portableContract'), effect.instance)
  assert.equal(core.getEffect('portableContract'), undefined, 'bare lookup stays unclaimed')
  for (const key of ['shaders', 'textures', 'passes', 'defaultProgram']) {
    assert.deepEqual(effect.instance[key], raw[key], key)
  }
})

test('Portable starter inference covers every pipeline input and honors explicit overrides', { skip }, async () => {
  const bindings = ['inputTex', 'inputTex3d', 'inputGeo', 'inputXyz', 'inputVel', 'inputRgba', 'src', 'o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']
  // Upstream pins this via isStarterOp(name); the published bundle does not export it, so pin the
  // same contract through the validator gate: a starter op compiles first-in-chain, a non-starter
  // op raises the illegal-chain diagnostic.
  const compilesAsStarter = (name) => {
    const func = name.split('.').pop()
    return eng.core.compile(`search user\n${func}().write(o0)\nrender(o0)`).diagnostics.length === 0
  }
  for (const [index, binding] of bindings.entries()) {
    const func = `portableInput${index}`
    await registerPortableEffect(core, definition(func, {
      passes: [{ program: 'main', inputs: { source: binding }, outputs: { fragColor: 'outputTex' } }]
    }))
    assert.equal(compilesAsStarter(`user.${func}`), false, binding)
  }
  await registerPortableEffect(core, definition('portableExplicitFilter', { starter: false }))
  assert.equal(compilesAsStarter('user.portableExplicitFilter'), false)
  await registerPortableEffect(core, definition('portableExplicitStarter', {
    starter: true, passes: [{ program: 'main', inputs: { source: 'inputTex' } }]
  }))
  assert.equal(compilesAsStarter('user.portableExplicitStarter'), true)
  await registerPortableEffect(core, definition('portableInferredStarter'))
  assert.equal(compilesAsStarter('user.portableInferredStarter'), true)
  assert.equal(core.getEffect('portableInferredStarter'), undefined)
})

test('A user.* portable effect compiles through the adapter DSL path with choice enums', { skip }, async () => {
  await registerPortableEffect(core, definition('portableParams', {
    globals: {
      mode: { type: 'int', default: 0, uniform: 'modeUniform', choices: { 'Modes:': -1, 'Soft Light': 3 } }
    }
  }))
  const graph = eng.compileGraph('search user\nportableParams(mode: SoftLight).write(o0)\nrender(o0)')
  const pass = graph.passes.find((p) => p.effectKey === 'user.portableParams')
  assert.ok(pass, JSON.stringify(graph.diagnostics || graph))
  assert.equal(pass.uniforms.modeUniform, 3, JSON.stringify(pass.uniforms))
})

test('A registered Portable paramAlias resolves to its canonical parameter', { skip }, async () => {
  // Upstream registers instance.paramAliases via registerParamAliases (vendor bundle's
  // CanvasRenderer.registerEffectWithRuntime); the adapter reaches the same internal registry
  // through that method, so an alias must resolve to its canonical parameter at compile time.
  await registerPortableEffect(core, definition('portableAlias', {
    globals: {
      mode: { type: 'int', default: 0, uniform: 'modeUniform', choices: { 'Modes:': -1, 'Soft Light': 3 } }
    },
    paramAliases: { oldMode: 'mode' }
  }))
  const graph = eng.compileGraph('search user\nportableAlias(oldMode: SoftLight).write(o0)\nrender(o0)')
  const pass = graph.passes.find((p) => p.effectKey === 'user.portableAlias')
  assert.ok(pass, JSON.stringify(graph.diagnostics || graph))
  assert.equal(pass.uniforms.modeUniform, 3, 'alias resolved to canonical modeUniform: ' + JSON.stringify(pass.uniforms))
})

test('Invalid Portable packages fail before registration and leave a valid name available', { skip }, async () => {
  const invalid = [null, [], definition('bad-name'), definition('portableInvalid', { namespace: 'synth' }),
    definition('portableInvalid', { passes: [] }), definition('portableInvalid', { passes: [null] }),
    definition('portableInvalid', { passes: [{ program: 'main', inputs: { src: 42 } }] }),
    definition('portableInvalid', { passes: [{ program: 'main', outputs: null }] }),
    definition('portableInvalid', { passes: [{ program: 'main', outputs: { color: '' } }] }),
    definition('portableInvalid', { shaders: {} }), definition('portableInvalid', { shaders: { main: { glsl: ' ' } } }),
    definition('portableInvalid', { passes: [{ program: 'a' }, { program: 'b' }],
      shaders: { a: { glsl: 'source' }, b: { wgsl: 'source' } } }),
    definition('portableInvalid', { globals: { amount: null } }), definition('portableInvalid', { starter: 'false' }),
    definition('portableInvalid', { paramAliases: 'bad' }),
    definition('portableInvalid', { paramAliases: { old: 42 } }),
    definition('portableInvalid', { paramAliases: { old: 'absent' } }),
    definition('portableInvalid', { globals: { mode: { type: 'int', choices: 'abc' } } }),
    definition('portableInvalid', { globals: { mode: { type: 'int', choices: { Broken: {} } } } })]
  for (const raw of invalid) {
    await assert.rejects(() => registerPortableEffect(core, raw), /Portable/)
    assert.equal(core.getEffect('user.portableInvalid'), undefined)
  }
  await registerPortableEffect(core, definition('portableInvalid'))
  assert.ok(core.getEffect('user.portableInvalid') instanceof core.Effect)
})

test('A name-only Portable effect preserves an existing bare built-in name', { skip }, async () => {
  const prior = new core.Effect({ namespace: 'synth', func: 'portableNameOnly' })
  core.registerEffect('portableNameOnly', prior)
  const raw = definition('portableNameOnly')
  delete raw.func
  const effect = await registerPortableEffect(core, raw)
  assert.equal(core.getEffect('portableNameOnly'), prior)
  assert.equal(core.getEffect('user.portableNameOnly'), effect.instance)
  assert.equal(effect.instance.func, 'portableNameOnly')
  assert.equal(isStarter('user.portableNameOnly'), true)
})

test('Duplicate Portable names cannot replace an accepted effect in the same realm', { skip }, async () => {
  const first = await registerPortableEffect(core, definition('portableDuplicate'))
  await assert.rejects(() => registerPortableEffect(core, definition('portableDuplicate', { starter: false })), /already registered/)
  assert.equal(core.getEffect('user.portableDuplicate'), first.instance)
  assert.equal(isStarter('user.portableDuplicate'), true)
})

test('Portable names and metadata cannot write through object prototypes', { skip }, async () => {
  const choices = { mode: { type: 'int', default: 0, choices: { Choice: 1 } } }
  for (const name of ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']) {
    const invalid = [
      definition(name, { globals: choices }),
      definition('portableReserved', { globals: { [name]: choices.mode } }),
      definition('portableReserved', { globals: { mode: { ...choices.mode, choices: { [name]: 1 } } } })
    ]
    for (const raw of invalid) {
      await assert.rejects(() => registerPortableEffect(core, raw), /Portable.*reserved/)
      assert.equal(core.getEffect('user.portableReserved'), undefined)
      assert.equal(Object.hasOwn(Object.prototype, 'mode'), false)
    }
  }
})
