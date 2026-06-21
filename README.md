# noisemaker-three

The [noisemaker](../noisemaker) shader-effect platform for **three.js**.

Unlike the sibling ports ([godot](../noisemaker-godot), [TouchDesigner](../noisemaker-td),
[Unity/HLSL](../noisemaker-hlsl)) — which each cross a language boundary and therefore
re-implement the executor and re-port every shader — three.js **is JavaScript**, the same
language as the reference. So noisemaker-three takes a fundamentally smaller, higher-fidelity
approach:

- **The entire DSL compiler is reused verbatim** (`lang/` lexer→parser→validator +
  `runtime/` expander/resources/compiler), vendored byte-for-byte and never hand-edited.
- **The executor (`runtime/pipeline.js`) is reused verbatim** — it is coupled only to an
  abstract `Backend` interface (`constructor(graph, backend)`).
- **All 182 effects' GLSL (`#version 300 es`) runs directly** via `RawShaderMaterial` +
  `glslVersion: THREE.GLSL3`. No shader re-porting.
- **The only substantial new code is one `ThreeBackend`** implementing the `Backend` interface
  on three.js primitives (`WebGLRenderTarget`, `RawShaderMaterial`, a fullscreen triangle,
  double-buffered surfaces), plus a thin integration surface.

The result: the 182 effects are not units of *porting* work — they are units of *parity
verification* that pass for free when the backend is faithful.

## Status

Candidate output is byte-identical to the reference WebGL2 golden.

- **Hero integration test: pixel-perfect over a full 30s run.** `parity/integration/hero.dsl` —
  a complex emergent program (3D perlin → 1M-agent flow field [emit/flow/pointsRender/billboards]
  → blur → o0; `navierStokes(read o0)` → palette/lighting/adjust → bloom/lens/vignette → o1) —
  matches the reference at `max-abs-diff=0.000` at every 5s sample across 1800 frames.
- **Stateless breadth: 162 PASS** (`parity/sweep-three.sh`), every one at `max-abs-diff=0.000` —
  synth, filter, mixer, classicNoisedeck, points (`wormhole`), MIDI data (`roll`), the full 3D
  namespace (synth3d/filter3d + render3d/renderLit3d/renderCubemap3d/renderCubemapSurface); Tier-1 included.
- **Stateful/continuous: 9/9 bit-exact** (`parity/sweep-stateful.sh`) — 2D: `navierStokes`,
  `convolutionFeedback`, `temporalAberration`, `reactionDiffusion`, `cellularAutomata`, `feedback`;
  3D: `cellularAutomata3d`, `reactionDiffusion3d`, `flow3d` (agent sim).

Two parity harnesses: `sweep-three.sh` (snapshot, for stateless effects) and `timeseries.mjs`/
`sweep-stateful.sh` (drives golden [vendored reference WebGL2] + candidate [ThreeBackend] with the
**identical** deterministic time sequence — the fair test for stateful effects). The snapshot
harness renders the golden at a fixed paused time, so it under-reports stateful parity; the
time-series harness shows those are bit-exact (incl. `reactionDiffusion`, which the sibling
Metal-vs-Vulkan ports skip — on our shared ANGLE/Metal driver it matches exactly).

Parity criterion: `max-abs-diff ≤ 2/255` AND `SSIM ≥ 0.98` (all PASSes hit 0.000).

### Genuinely not yet covered (see `docs/IMPLEMENTATION-PLAN.md`)
- **Audio-driven** (`scope`, `spectrum`), `media` decode, and **mesh** (`meshLoader`/`meshRender`,
  OBJ via `canvas.loadOBJFromURL`): need external input/decoding — deferred. (The external-texture
  *binding* exists — `setExternalTexture`/`updateTextureFromSource` — so `media`'s shader works once
  fed a source; see `NoisemakerPass`.)
- **`loopBegin`/`loopEnd`** accumulator-feedback primitives: shaders compile, but the loop-accumulator
  parity path is not yet exercised.
- Broader corpus validation against **blaster.noisedeck.app**.

### Done since first cut
- **Full 3D namespace bit-exact** (`max-abs-diff=0.000`): `synth3d` (×7), `filter3d` (×2), and the
  3D renderers `render3d`/`renderLit3d`/`renderCubemap3d`/`renderCubemapSurface`. Volumes are
  2D-flattened atlases raymarched in-shader (no `createTexture3D`/GL-cubemaps needed); cubemap
  faces render to a 2D `rgba16f` target via the `cubeBasis` uniform.
- **`remap` bit-exact** — std140 UBO support (`RemapUniforms`/`uniformLayout`), verified trivial +
  zoned (`max-abs-diff=0.000`).
- **classicNoisedeck meta/param effects** (`composite`, `effects`, `colorLab`, `kaleido`,
  `refract`, …): pass as filters with hand-authored DSL.
- **points/agent effects** (attractor, buddhabrot, dla, flock, flow, hydraulic, lenia, life,
  physarum, physical): bit-exact via time-series.

### Integration surface
- **`NoisemakerCanvas`** — standalone full-screen renderer (the parity workhorse). ✅
- **`NoisemakerTexture`** — run a DSL program offscreen, exposed as a stable `THREE.Texture` for
  materials / scene backgrounds, sharing the caller's renderer. ✅ verified pixel-perfect
  (`max-abs-diff=0.000`); see `examples/texture-on-mesh.html`.
- **`NoisemakerPass`** — EffectComposer post-processing pass. ✅ Filter mode (`media()` samples
  the scene) or generative overlay. Verified generative output == `NoisemakerCanvas`
  (`max-abs-diff=0.000`) + scene→source binding (`parity/pass-test.mjs`); see
  `examples/effect-composer-pass.html`.

### Remaining (see `docs/IMPLEMENTATION-PLAN.md`)
- Backend features (MRT mixed-format, points/billboards, additive blend, `uploadDataTexture`,
  std140 UBO): **done.** ✅
- 3D volumes + cubemaps for `synth3d`/`filter3d`/`render`: **done** (2D-flattened atlases
  raymarched in-shader; no real `createTexture3D`/GL-cubemaps needed). ✅
- Integration trio (`NoisemakerCanvas`/`NoisemakerTexture`/`NoisemakerPass`): **done.** ✅
- External-input *decoding* (audio `scope`/`spectrum`, `media`, mesh OBJ); `loopBegin`/`loopEnd`
  accumulator parity; broader **blaster.noisedeck.app** corpus validation.

## Quickstart

```js
import { NoisemakerCanvas } from 'noisemaker-three' // peer dep: three

const nm = new NoisemakerCanvas(document.querySelector('canvas'), { width: 512, height: 512 })
await nm.compile(`
  search synth, filter
  noise(seed: 1, scaleX: 50, scaleY: 50).bloom().write(o0)
  render(o0)
`)
function frame(t) { nm.renderFrame((t / 4000) % 1); requestAnimationFrame(frame) }
requestAnimationFrame(frame)
```

As a texture in your own three.js scene (shares your renderer):

```js
import { NoisemakerTexture } from 'noisemaker-three'

const nmTex = new NoisemakerTexture(renderer, { width: 512, height: 512 })
await nmTex.compile('search synth\nnoise(octaves: 4, speed: 1).write(o0)\nrender(o0)')
material.map = nmTex.texture            // stable texture; set once
// in your render loop:
nmTex.update((performance.now() / 6000) % 1)
```

## Develop

```bash
npm install            # installs three (pinned) + dev tooling
npm run sync           # vendor the reference core + effects (byte-identical, provenance-tracked)
npm test               # capability gate, vendor integrity, compiler-in-repo, resources
bash parity/run.sh noise   # render reference golden + three.js candidate, compare pixels
```

`parity/compare.py` needs numpy + Pillow (self-contained venv):

```bash
python3 -m venv parity/.venv && parity/.venv/bin/pip install -r parity/requirements.txt
bash parity/sweep-three.sh        # full breadth sweep (override python via NM_PY)
```

## Layout

```
src/
  index.js                      public API
  backend/three-backend.js      ThreeBackend extends Backend  (the work)
  backend/three-resources.js    RT/format/geometry helpers
  runtime/create-three-pipeline.js
  integration/canvas.js         NoisemakerCanvas
  effects/                      loader (node + browser) + DSL effect extraction
  vendor/noisemaker/**          synced reference core + effects (NEVER hand-edited)
parity/                         golden renderer, candidate renderer, compare.py, programs
docs/                           design spec + implementation plan
reference/                      engine-agnostic specs (shared with sibling ports)
```

## Provenance / status

Local, greenfield, self-contained. Not published; do not push without explicit instruction.
Vendored core is pinned to a reference commit (`src/vendor/UPSTREAM.json`) and enforced
byte-identical by `test/vendor-integrity.test.mjs`.
