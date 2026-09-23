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

test('compileGraph handles filter/adjust and rejects expired effects (bc, colorspace, hs)', { skip }, () => {
  const g = eng.compileGraph('search synth, filter\nnoise().adjust().write(o0)\nrender(o0)')
  assert.ok(Array.isArray(g.passes) && g.passes.length >= 1, 'adjust compiles')

  for (const eff of ['bc', 'colorspace', 'hs']) {
    const res = eng.core.compile(`search synth, filter\nnoise().${eff}().write(o0)`)
    assert.ok(
      res.diagnostics.some((d) => d.code === 'S001'),
      `expired effect ${eff} should produce unknown effect diagnostic S001`
    )
  }
})

test('public compiler rejects output surfaces outside o0-o7 in every DSL position', { skip }, () => {
  const cases = [
    {
      name: 'render target',
      source: 'search synth\nrender(o8)',
      expected: /^Output surface reference 'o8' is out of range; expected o0-o7 at line 2 col 8$/,
    },
    {
      name: 'read source',
      source: 'search synth\nread(o99).write(o0)',
      expected: /^Output surface reference 'o99' is out of range; expected o0-o7 at line 2 col 6$/,
    },
    {
      name: 'write target',
      source: 'search synth\nread(o0).write(o10)',
      expected: /^Output surface reference 'o10' is out of range; expected o0-o7 at line 2 col 16$/,
    },
  ]

  for (const { name, source, expected } of cases) {
    assert.throws(
      () => eng.core.compile(source),
      (error) => error instanceof SyntaxError && expected.test(error.message),
      `${name} should throw SyntaxError with expected message`
    )
  }
})

test('public compiler preserves o0 and o7 boundary behavior', { skip }, () => {
  const compiled = eng.core.compile('search synth\nread(o0).write(o7)\nrender(o7)')
  assert.deepEqual(compiled.plans[0].chain[0].args.tex, { kind: 'output', name: 'o0' })
  assert.deepEqual(compiled.plans[0].write, { kind: 'output', name: 'o7' })
  assert.equal(compiled.render, 'o7')

  const g = eng.compileGraph('search synth\nread(o0).write(o7)\nrender(o7)')
  assert.equal(g.renderSurface, 'o7')
})

test('output-shaped member segments and other reference families keep existing behavior', { skip }, () => {
  const compiled = eng.core.compile(
    'search synth\nlet low = foo.o0\nlet high = foo.o7\nlet extended = foo.o8\nlet many = foo.o99'
  )
  assert.deepEqual(
    compiled.vars.map(({ expr }) => expr.path),
    [['foo', 'o0'], ['foo', 'o7'], ['foo', 'o8'], ['foo', 'o99']]
  )

  const tokens = eng.core.lex('s99 vol99 geo99 xyz99 vel99 rgba99 mesh99')
  assert.deepEqual(
    tokens.map(({ type, lexeme }) => ({ type, lexeme })),
    [
      { type: 'SOURCE_REF', lexeme: 's99' },
      { type: 'VOL_REF', lexeme: 'vol99' },
      { type: 'GEO_REF', lexeme: 'geo99' },
      { type: 'XYZ_REF', lexeme: 'xyz99' },
      { type: 'VEL_REF', lexeme: 'vel99' },
      { type: 'RGBA_REF', lexeme: 'rgba99' },
      { type: 'MESH_REF', lexeme: 'mesh99' },
      { type: 'EOF', lexeme: '' },
    ]
  )
})

test('mutation introspection excludes builtins from steps and replacement targets', { skip }, () => {
  const compiled = eng.core.compile('search synth, filter\nnoise(10).write(o0)\nrender(o0)')
  const steps = eng.core.listSteps(compiled)
  assert.equal(steps.length, 1, 'listSteps should only return user effect steps, excluding builtins')
  assert.equal(steps[0].effectName, 'synth.noise', 'First step is noise')

  const builtinSteps = compiled.plans[0].chain.filter((step) => step.builtin)
  assert.ok(builtinSteps.length >= 1, 'chain has builtin steps')
  for (const builtin of builtinSteps) {
    const replaceResult = eng.core.replaceEffect(compiled, builtin.temp, 'bloom')
    assert.equal(replaceResult.success, false, 'replaceEffect on builtin step should fail')
    assert.equal(replaceResult.error, `Step with index ${builtin.temp} not found`)

    const compatResult = eng.core.getCompatibleReplacements(compiled, builtin.temp)
    assert.equal(compatResult.success, false, 'getCompatibleReplacements on builtin step should fail')
    assert.equal(compatResult.error, `Step with index ${builtin.temp} not found`)
  }

  const validCompat = eng.core.getCompatibleReplacements(compiled, steps[0].stepIndex)
  assert.equal(validCompat.success, true, 'getCompatibleReplacements on user step should succeed')
  assert.ok(validCompat.compatible.includes('synth.solid'), 'compatible list should include starter effect')
})

test('DSL diagnostics preserve source columns across compiler positions', { skip }, () => {
  const result = eng.core.compile('search synth\n  read(123).write(o0)')
  const diagSummary = result.diagnostics.map(({ code, location }) => ({ code, location }))
  assert.deepEqual(diagSummary, [
    { code: 'S001', location: { line: 2, column: 3 } },
    { code: 'S005', location: { line: 2, column: 13 } },
  ])

  const inlineReadResult = eng.core.compile('search synth\n\n    noise().read(o0).write(o1)')
  const inlineReadDiag = inlineReadResult.diagnostics.find((d) => d.code === 'S001')
  assert.ok(inlineReadDiag, 'inline read produces S001 diagnostic')
  assert.deepEqual(inlineReadDiag.location, { line: 3, column: 13 })
})

test('DSL lexer attaches structured diagnostic payload with code, location, and span', { skip }, () => {
  const cases = [
    {
      src: '@noise()',
      code: 'L001',
      location: { line: 1, column: 1 },
      span: { start: 0, end: 1 }
    },
    {
      src: 'noise("unterminated)',
      code: 'L002',
      location: { line: 1, column: 7 },
      span: { start: 6, end: 20 }
    },
    {
      src: '/* unclosed comment\nnoise()',
      code: 'L003',
      location: { line: 1, column: 1 },
      span: { start: 0, end: 27 }
    },
    {
      src: 'search synth\nnoise().write(o8)',
      code: 'L004',
      location: { line: 2, column: 15 },
      span: { start: 27, end: 29 }
    }
  ]

  for (const c of cases) {
    assert.throws(
      () => eng.core.compile(c.src),
      (err) => {
        assert.ok(err instanceof SyntaxError, `Expected SyntaxError for ${c.code}`)
        assert.ok(err.diagnostic, `Expected attached diagnostic for ${c.code}`)
        assert.equal(err.diagnostic.code, c.code)
        assert.equal(err.diagnostic.stage, 'lexer')
        assert.equal(err.diagnostic.severity, 'error')
        assert.equal(err.diagnostic.message, err.message)
        assert.ok(typeof err.diagnostic.message === 'string' && err.diagnostic.message.length > 0)
        assert.deepEqual(err.diagnostic.location, c.location)
        assert.deepEqual(err.diagnostic.span, c.span)
        return true
      }
    )
  }
})

test('DSL parser attaches structured diagnostic payload with code, location, and span', { skip }, () => {
  const cases = [
    {
      src: 'search synth\nrender o0',
      code: 'P001',
      location: { line: 2, column: 8 }
    },
    {
      src: 'search synth\nrender(o0',
      code: 'P002',
      location: { line: 2, column: 10 }
    },
    {
      src: 'search synth\nlet = 1',
      code: 'P001',
      location: { line: 2, column: 5 }
    },
    {
      src: 'search synth\nlet x 1',
      code: 'P001',
      location: { line: 2, column: 7 }
    },
    {
      src: 'search synth\nif(true) return 1',
      code: 'P001',
      location: { line: 2, column: 10 }
    },
    {
      src: 'search synth\nrender(o0) xyz',
      code: 'P001',
      location: { line: 2, column: 12 }
    },
    {
      src: 'search synth\nfoo(1',
      code: 'P002',
      location: { line: 2, column: 6 }
    },
    {
      src: 'search synth\nfoo().write3d(tex3d0 geo0)',
      code: 'P001',
      location: { line: 2, column: 22 }
    },
    {
      src: '// 😀\r\nsearch synth\r\n\trender(o0',
      code: 'P002',
      location: { line: 3, column: 11 }
    },
    {
      src: 'search synth\nlet x = "😀"; render o0',
      code: 'P001',
      location: { line: 2, column: 22 }
    }
  ]

  for (const c of cases) {
    assert.throws(
      () => eng.core.compile(c.src),
      (err) => {
        assert.ok(err instanceof SyntaxError, `Expected SyntaxError for ${c.code}`)
        assert.ok(err.diagnostic, `Expected attached diagnostic for ${c.code}`)
        assert.equal(err.diagnostic.code, c.code)
        assert.equal(err.diagnostic.stage, 'parser')
        assert.equal(err.diagnostic.severity, 'error')
        assert.equal(err.diagnostic.message, err.message)
        assert.ok(typeof err.diagnostic.message === 'string' && err.diagnostic.message.length > 0)
        assert.deepEqual(err.diagnostic.location, c.location)
        assert.equal(err.diagnostic.span, null)
        return true
      }
    )
  }
})

test('parser expectation diagnostics represent unavailable caller-token coordinates explicitly', { skip }, () => {
  const { lex, parse } = eng.core

  for (const coordinates of [{}, { line: 1 }, { line: 0, col: 1 }, { line: 1, col: NaN }]) {
    const tokens = lex('search synth\nrender o0').map((token) => {
      if (token.type !== 'OUTPUT_REF') return token
      return { type: token.type, lexeme: token.lexeme, ...coordinates }
    })
    assert.throws(
      () => parse(tokens),
      (err) => {
        assert.equal(err.message, `Expect '(' at line ${coordinates.line} col ${coordinates.col}`)
        assert.deepEqual(err.diagnostic, {
          code: 'P001',
          stage: 'parser',
          severity: 'error',
          message: err.message,
          location: null,
          span: null
        })
        return true
      }
    )
  }
})

test('renderLandscape3d filtering define choices compile with expected defines', { skip }, () => {
  const defaultProgram =
    'search synth, synth3d, render\nheightmap3d(heightTex: read(o1), tex: read(o2)).renderLandscape3d().write(o0)\nrender(o0)'
  const isoProgram =
    'search synth, synth3d, render\nheightmap3d(heightTex: read(o1), tex: read(o2)).renderLandscape3d(filtering: isosurface).write(o0)\nrender(o0)'
  const voxelProgram =
    'search synth, synth3d, render\nheightmap3d(heightTex: read(o1), tex: read(o2)).renderLandscape3d(filtering: voxel).write(o0)\nrender(o0)'

  const defaultGraph = eng.compileGraph(defaultProgram)
  const defaultPass = defaultGraph.passes.find((p) => p.effectFunc === 'renderLandscape3d')
  assert.ok(defaultPass, 'renderLandscape3d pass found')
  assert.equal(defaultGraph.programs[defaultPass.program].defines.FILTERING, 1)

  const isoGraph = eng.compileGraph(isoProgram)
  const isoPass = isoGraph.passes.find((p) => p.effectFunc === 'renderLandscape3d')
  assert.ok(isoPass, 'renderLandscape3d pass found')
  assert.equal(isoGraph.programs[isoPass.program].defines.FILTERING, 0)

  const voxelGraph = eng.compileGraph(voxelProgram)
  const voxelPass = voxelGraph.passes.find((p) => p.effectFunc === 'renderLandscape3d')
  assert.ok(voxelPass, 'renderLandscape3d pass found')
  assert.equal(voxelGraph.programs[voxelPass.program].defines.FILTERING, 1)
})
