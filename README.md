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
- **Stateless breadth: 142 PASS** (`parity/sweep-three.sh`), every one at `max-abs-diff=0.000` —
  synth, filter, mixer, classicNoisedeck, points (`wormhole`), MIDI data (`roll`); Tier-1 included.
- **Stateful/continuous: 6/6 bit-exact** (`parity/sweep-stateful.sh`) — `navierStokes`,
  `convolutionFeedback`, `temporalAberration`, `reactionDiffusion`, `cellularAutomata`, `feedback`.

Two parity harnesses: `sweep-three.sh` (snapshot, for stateless effects) and `timeseries.mjs`/
`sweep-stateful.sh` (drives golden [vendored reference WebGL2] + candidate [ThreeBackend] with the
**identical** deterministic time sequence — the fair test for stateful effects). The snapshot
harness renders the golden at a fixed paused time, so it under-reports stateful parity; the
time-series harness shows those are bit-exact (incl. `reactionDiffusion`, which the sibling
Metal-vs-Vulkan ports skip — on our shared ANGLE/Metal driver it matches exactly).

Parity criterion: `max-abs-diff ≤ 2/255` AND `SSIM ≥ 0.98` (all PASSes hit 0.000).

### Genuinely not yet covered (see `docs/IMPLEMENTATION-PLAN.md`)
- **`remap`**: RGB pixel-perfect (ssim 1.0) but the alpha channel diverges (new upstream UBO path).
- **Audio-driven** (`scope`, `spectrum`) and `media`: need audio / external input — deferred.
- **3D**: `synth3d`/`filter3d` (`createTexture3D` + cubemaps, Phase 5.5).
- **`buddhabrot`** and a few other points/agent effects: not yet parity-checked individually.
- **11 classicNoisedeck meta/param effects** (`composite`, `effects`, `colorLab`, `kaleido`,
  `refract`, …): need hand-authored DSL (auto-generated default programs are invalid for them).
- Broader corpus validation against **blaster.noisedeck.app**.

### Integration surface
- **`NoisemakerCanvas`** — standalone full-screen renderer (the parity workhorse). ✅
- **`NoisemakerTexture`** — run a DSL program offscreen, exposed as a stable `THREE.Texture` for
  materials / scene backgrounds, sharing the caller's renderer. ✅ verified pixel-perfect
  (`max-abs-diff=0.000`); see `examples/texture-on-mesh.html`.
- **`NoisemakerPass`** — EffectComposer post-processing pass. ⏳ next.

### Remaining (see `docs/IMPLEMENTATION-PLAN.md`)
- Phase 3 backend features (MRT mixed-format, points/billboards, additive blend,
  `uploadDataTexture`): **done.** ✅
- Phase 5.5: 3D volumes (`createTexture3D`) and cubemaps for `synth3d`/`filter3d`.
- Hand-authored DSL for 11 classicNoisedeck meta/param effects; stateful-sim multi-sample
  verification (30s/5s) for chaotic agent + continuous solvers; `remap` alpha.
- `NoisemakerPass` (EffectComposer) — needs source-surface input binding.

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
