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

- **Full breadth sweep: 86 PASS / 0 FAIL / 1 SKIP** (`parity/sweep-three.sh`), every PASS at
  `max-abs-diff=0.000, ssim=1.00000` — across synth, filter, mixer, classicNoisedeck
  (single-pass, multi-pass, two-input, feedback, ping-pong state sims). Includes Tier-1
  (`solid, gradient, noise, cell, shape, osc2d, blur, blendMode`) and discrete state sims
  (`cellularAutomata` bit-exact, `feedback`).
- **1 documented skip:** `reactionDiffusion` — a continuous Gray-Scott solver at the stability
  limit; seed is bit-exact (verified at `speed:0`), but per-frame evolution amplifies sub-ULP
  shader-compilation fp differences. Same skip as the same-driver Babylon port and Godot.

Parity criterion (inherited from the sibling ports): `max-abs-diff ≤ 2/255` AND `SSIM ≥ 0.98`.
Run the sweep: `bash parity/sweep-three.sh`.

### Remaining (see `docs/IMPLEMENTATION-PLAN.md`)
- Phase 3 backend features for effects that need them: MRT, `drawMode:"points"`/billboards,
  additive blend, per-pass viewport (currently throw "not yet implemented").
- Phase 5.5: 3D volumes (`createTexture3D`) and cubemaps for `synth3d`/`filter3d`.
- Phase 5: full-catalog parity sweep (182 effects) with per-effect tolerance table; document
  cross-device-divergent continuous solvers (e.g. `reactionDiffusion`).
- Phase 6: `NoisemakerTexture` (effect → `THREE.Texture`) and `NoisemakerPass` (EffectComposer).

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

## Develop

```bash
npm install            # installs three (pinned) + dev tooling
npm run sync           # vendor the reference core + effects (byte-identical, provenance-tracked)
npm test               # capability gate, vendor integrity, compiler-in-repo, resources
bash parity/run.sh noise   # render reference golden + three.js candidate, compare pixels
```

`parity/compare.py` needs numpy + Pillow; point `NM_PY` at a venv python (defaults to the
sibling port's venv).

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
