# noisemaker-three

**A thin three.js _adapter_ for the noisemaker shader engine — not a port.**

noisemaker-three is ~2,900 lines of authored code over the **unmodified** noisemaker reference
engine. Because the reference already runs on JavaScript + WebGL2, there is nothing to
re-implement or re-port:

- **The DSL compiler, expander, and executor (`runtime/pipeline.js`) are the reference, unchanged.**
- **All 182 effects' GLSL (`#version 300 es`) runs directly** via `RawShaderMaterial` +
  `glslVersion: THREE.GLSL3`. No shader re-porting.
- **The only authored code of substance is one `ThreeBackend`** (~760 LOC) implementing the
  reference's abstract `Backend` interface on three.js primitives (`WebGLRenderTarget`,
  `RawShaderMaterial`, a fullscreen triangle, double-buffered surfaces), plus the
  `NoisemakerCanvas`/`Texture`/`Pass` wrappers and a parity harness.

**The reference engine is never committed here.** At runtime it loads from the noisemaker CDN —
`https://shaders.noisedeck.app/1/noisemaker-shaders-core.esm.js` (the engine bundle, which exports
`Backend`/`Pipeline`/`compileGraph`/… so `ThreeBackend` can be injected) plus `…/1/effects`
(effect bundles, fetched on demand) — the same source the production apps consume. For offline
parity work, a local mirror is synced into the **git-ignored** `src/vendor/` via `npm run sync`.

The result: the 182 effects are not units of *porting* work — they are units of *parity
verification* that pass when the adapter is faithful (byte-identical, since it's the same shaders
on the same WebGL2 driver the reference itself uses).

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
- **Live corpus: every real composition bit-exact** (`parity/sweep-corpus.sh`) — the full
  public noisedeck gallery, fetched program-for-program (`parity/fetch-corpus.mjs`) and run
  through the dual-backend time-series harness, `worst max-abs-diff=0`. These are real,
  emergent, frequently-stateful user programs (kaleido, reaction-diffusion, 3D lit volumes,
  attractors, particle→navier-Stokes chains).

Three parity harnesses: `sweep-three.sh` (snapshot, for stateless effects), `timeseries.mjs`/
`sweep-stateful.sh` (drives golden [vendored reference WebGL2] + candidate [ThreeBackend] with the
**identical** deterministic time sequence — the fair test for stateful effects), and
`sweep-corpus.sh` (the same time-series test over fetched real programs). The snapshot
harness renders the golden at a fixed paused time, so it under-reports stateful parity; the
time-series harness shows those are bit-exact (incl. `reactionDiffusion`, which the sibling
Metal-vs-Vulkan ports skip — on our shared ANGLE/Metal driver it matches exactly).

Parity criterion: `max-abs-diff ≤ 2/255` AND `SSIM ≥ 0.98` (all PASSes hit 0.000).

### External-input effects — parity via DETERMINISTIC injected inputs
A live feed (mic, camera, OBJ URL) is nondeterministic, so these are parity-tested by injecting a
fixed synthetic input identically into golden + candidate (`parity/page-timeseries.html`
`applyInject()`, driven by a `<name>.inject.json` sidecar). This exercises the real binding/upload +
shader path the same way the rest of the catalog is validated.
- **`scope`, `spectrum`** (audio): byte-identical with an injected 128-sample waveform/spectrum
  (`uniform float audioWaveform[128]` via `setAudioState`). `max-abs-diff=0.000`.
- **`media`** (video/image): byte-identical with an injected 1024² canvas bound to the external
  `imageTex` (`updateTextureFromSource`). `max-abs-diff=0.000`.
- **`meshLoader`/`meshRender`** (OBJ): byte-identical with an injected cube OBJ — `uploadMeshData`
  (mesh-surface textures) + a `triangles` draw path (depth test + back-face cull; the VS fetches
  vertices from the mesh textures by `gl_VertexID`). `max-abs-diff=0.000`.

**All 182/182 funcs are byte-identical** — the whole catalog, with the 5 external-input effects fed
deterministic synthetic inputs.

The external-input *binding/upload* infrastructure exists (`setExternalTexture`,
`updateTextureFromSource`, `uploadDataTexture`, pipeline `setAudioState`) — only the live
data acquisition is out of scope.

### Done since first cut — **182/182 funcs bit-exact**
- **Full 3D namespace** (`max-abs-diff=0.000`): `synth3d` (×7), `filter3d` (×2), and the
  3D renderers `render3d`/`renderLit3d`/`renderCubemap3d`/`renderCubemapSurface`. Volumes are
  2D-flattened atlases raymarched in-shader (no `createTexture3D`/GL-cubemaps needed); cubemap
  faces render to a 2D `rgba16f` target via the `cubeBasis` uniform.
- **`remap` + `mashup`** — std140 UBO support (`uniformLayout`), verified trivial + zoned.
- **`loopBegin`/`loopEnd`** accumulator-feedback primitives — corpus-validated (10 corpus
  programs use them, all bit-exact).
- **Canvas2D-overlay effects** (`fibers`, `scratches`, `strayHair`) — bit-exact via a raw-GL
  upload matching the reference's `BROWSER_DEFAULT` colorspace (three forces `NONE`).
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

The repo contains only the adapter; the reference engine is **not committed** (it loads from the
CDN at runtime — see Provenance). For local development and parity, mirror the reference into the
git-ignored `src/vendor/` once:

```bash
npm install                                            # three (pinned) + dev tooling
NM_REFERENCE_ROOT=/path/to/noisemaker npm run sync     # populate the git-ignored src/vendor/ mirror
npm test                                               # capability gate, vendor integrity, compiler, resources
```

`npm test` and the parity harness require that synced mirror (the adapter has nothing to drive
without the engine). Golden parity for one program:

```bash
NM_REFERENCE_ROOT=/path/to/noisemaker bash parity/run.sh noise   # golden + candidate, compare pixels
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
  vendor/**                     git-ignored local mirror of the reference (npm run sync; NEVER committed)
parity/                         golden renderer, candidate renderer, compare.py, programs
docs/                           design spec + implementation plan
reference/                      engine-agnostic specs (shared with sibling ports)
```

## Provenance / status

**This is a thin adapter, not a port.** ~2,900 lines of authored code (`ThreeBackend` ~760,
integration wrappers, parity harness) drive the unmodified noisemaker reference engine (~124k LOC:
compiler + pipeline + every effect + GLSL). The 182/182 byte-identical result follows because it
is the same `#version 300 es` shaders on the same WebGL2 driver the reference uses; the real work
was making the `ThreeBackend` shim faithful.

**The reference engine is never committed to this repo.** At runtime it loads from the noisemaker
CDN — `https://shaders.noisedeck.app/1/noisemaker-shaders-core.esm.js` (the engine bundle; exports
`Backend`, `Pipeline`, `compileGraph`, `registerEffect`, … so `ThreeBackend` is injected into the
reference `Pipeline`) plus `…/1/effects` (effect bundles, on demand) — the same source the
production apps use. For offline dev/parity, `npm run sync` (with `NM_REFERENCE_ROOT`) mirrors the
reference into the **git-ignored** `src/vendor/`. Nothing under `src/vendor/` is ever committed
(enforced by `.gitignore`); `test/vendor-integrity.test.mjs` verifies the local mirror against a
synced sha256 manifest and skips cleanly when the mirror is absent.
