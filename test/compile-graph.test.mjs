import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootEngine } from '../vendor/engine.mjs'

// Proves the PUBLISHED engine (fetched from the CDN by vendor/fetch.sh) runs in-repo: DSL text
// -> RenderGraph with GLSL program source, no GPU needed. The core ESM + effect mini-bundles are
// loaded behind a DOM shim (vendor/engine.mjs). Skips cleanly when the engine isn't fetched yet.
const CORE = fileURLToPath(new URL('../vendor/noisemaker/noisemaker-shaders-core.esm.js', import.meta.url))
const skip = existsSync(CORE) ? false : 'engine not fetched — run `bash vendor/fetch.sh` first'
const eng = skip ? null : await bootEngine()

test('compileGraph produces a GLSL render graph for solid', { skip }, () => {
  const g = eng.compileGraph('search synth\nsolid(0.2, 0.6, 0.9).write(o0)\nrender(o0)')
  assert.ok(Array.isArray(g.passes) && g.passes.length >= 1, 'has passes')
  assert.ok(g.programs && typeof g.programs === 'object', 'has programs')
  assert.ok(g.renderSurface, 'has a render surface')
  const withGlsl = Object.values(g.programs).find((p) => typeof (p.glsl || p.fragment) === 'string')
  assert.ok(withGlsl, 'a program carries GLSL source')
  assert.match(withGlsl.glsl || withGlsl.fragment, /void\s+main/, 'GLSL has a main()')
})

test('compileGraph handles multi-pass blur over noise (two namespaces)', { skip }, () => {
  const g = eng.compileGraph(
    'search synth, filter\nnoise(seed: 1, scaleX: 50, scaleY: 50)\n.blur(radiusX: 8, radiusY: 8)\n.write(o0)\nrender(o0)'
  )
  assert.ok(g.passes.length >= 2, 'blur expands to multiple passes')
  const effectProgs = Object.values(g.programs).filter((p) => p.glsl || p.fragment)
  assert.ok(effectProgs.length >= 1, 'effect programs carry GLSL')
})

test('compileGraph compiles chained variable alias to terminal write blit', { skip }, () => {
  const g = eng.compileGraph(
    'search synth, filter\nlet eff = rotate(1, 0.1)\nnoise().eff().write(o0)\nrender(o0)'
  )
  assert.equal(g.passes.length, 3, 'noise + rotate + write blit')
  assert.equal(g.passes[0].id, 'node_0_pass_0')
  assert.equal(g.passes[1].id, 'node_1_pass_0')
  assert.equal(g.passes[2].id, 'node_2_write_blit')
  assert.equal(g.passes[2].program, 'blit', 'terminal pass is blit')
  assert.equal(g.passes[2].inputs?.src, 'node_1_out')
  assert.equal(g.passes[2].outputs?.color, 'global_o0')
})

test('legacy MIDI note mode channels must be static integers from 1 to 16', { skip }, () => {
  const modes = ['noteChange', 'gateNote', 'gateVelocity', 'triggerNote', 'velocity']
  for (const mode of modes) {
    for (const channel of ['0', '17', '1.5', 'true', '"1"', 'osc()']) {
      const compiled = eng.core.compile(
        `search synth\nnoise(scaleX: midi(channel: ${channel}, mode: midiMode.${mode})).write(o0)`
      )
      assert.ok(
        compiled.diagnostics.some((d) => d.code === 'S001' || d.code === 'S002'),
        `${mode} channel ${channel} should produce a validation diagnostic`
      )
      assert.equal(
        compiled.plans[0].chain[0].args.scaleX._invalid,
        true,
        `${mode} channel ${channel} should keep the descriptor inert`
      )
    }
    for (const channel of [1, 16]) {
      const compiled = eng.core.compile(
        `search synth\nnoise(scaleX: midi(channel: ${channel}, mode: midiMode.${mode})).write(o0)`
      )
      assert.equal(compiled.diagnostics.length, 0, `${mode} channel ${channel} should remain valid`)
      assert.equal(compiled.plans[0].chain[0].args.scaleX.channel, channel, `${mode} channel ${channel} compiles`)
      assert.equal(compiled.plans[0].chain[0].args.scaleX._invalid, undefined)
    }
  }
})

test('Pipeline recreates textures on ThreeBackend when format changes', { skip }, async () => {
  const { ThreeBackend } = await import('../src/backend/three-backend.js')
  const mockRenderer = {
    getContext: () => ({
      MAX_DRAW_BUFFERS: 8,
      MAX_TEXTURE_SIZE: 8192,
      READ_FRAMEBUFFER_BINDING: 3,
      DRAW_FRAMEBUFFER_BINDING: 4,
      TEXTURE_BINDING_2D: 5,
      getParameter: () => 8,
      createFramebuffer: () => ({}),
      bindFramebuffer: () => {},
      deleteFramebuffer: () => {},
      createTexture: () => ({}),
      bindTexture: () => {},
      texImage2D: () => {},
      framebufferTexture2D: () => {},
      drawBuffers: () => {},
      checkFramebufferStatus: () => 30,
      deleteTexture: () => {},
      getError: () => 0,
    }),
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    setClearColor: () => {},
    clear: () => {},
  }
  const backend = new ThreeBackend(mockRenderer)
  const spec = { format: 'rgba32f', width: 100, height: 100 }
  const graph = {
    passes: [],
    textures: new Map([['node_0_state', spec]]),
  }
  const pipeline = new eng.Pipeline(graph, backend)
  pipeline.width = 100
  pipeline.height = 100
  pipeline.recreateTextures()
  const tex1 = backend.textures.get('node_0_state')
  assert.equal(tex1.format, 'rgba32f')

  spec.format = 'rgba16f'
  pipeline.recreateTextures()
  const tex2 = backend.textures.get('node_0_state')
  assert.equal(tex2.format, 'rgba16f')
  assert.notEqual(tex1, tex2, 'texture was recreated on format change')

  pipeline.recreateTextures()
  const tex3 = backend.textures.get('node_0_state')
  assert.equal(tex3, tex2, 'matching texture is reused without recreation')
})
