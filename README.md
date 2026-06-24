# noisemaker-three

**A thin three.js _adapter_ for the noisemaker shader engine — not a port.**

noisemaker-three is ~2,900 lines of authored code over the **unmodified** noisemaker reference
engine. Because the reference already runs on JavaScript + WebGL2, there is nothing to
re-implement or re-port:

- **The DSL compiler, expander, and executor (`runtime/pipeline.js`) are the reference, unchanged.**
- **All 184 effects' GLSL (`#version 300 es`) runs directly** via `RawShaderMaterial` +
  `glslVersion: THREE.GLSL3`. No shader re-porting.
- **The only authored code of substance is one `ThreeBackend`** (~760 LOC) implementing the
  reference's abstract `Backend` interface on three.js primitives (`WebGLRenderTarget`,
  `RawShaderMaterial`, a fullscreen triangle, double-buffered surfaces), plus the
  `NoisemakerCanvas`/`Texture`/`Pass` wrappers and a parity harness.

**The reference engine is never committed here.** At runtime it loads from the noisemaker CDN —
`https://shaders.noisedeck.app/1/noisemaker-shaders-core.esm.js` (the engine bundle, which exports
`Backend`/`Pipeline`/`compileGraph`/… so `ThreeBackend` can be injected) plus `…/1/effects`
(effect bundles, fetched on demand) — the same source the production apps consume. `npm run vendor`
(`vendor/fetch.sh`) mirrors that published engine into the **git-ignored** `vendor/` (node_modules
posture: the fetch script + a small loader are committed, never the engine bytes); the adapter
imports the engine from there (`src/engine-browser.js` for the browser, `vendor/engine.mjs` for Node).

The result: the 184 effects are not units of *porting* work — they are units of *parity
verification* that pass when the adapter is faithful (byte-identical, since it's the same shaders
on the same WebGL2 driver the reference itself uses).

## Status

Candidate output is byte-identical to the golden — and the golden is the **same CDN engine's own
`WebGL2Backend`**, so parity is a true backend-vs-backend diff (same shaders, same ANGLE/Metal driver).

- **Hero integration test: pixel-perfect over a full 30s run.** `parity/integration/hero.dsl` —
  a complex emergent program (3D perlin → 1M-agent flow field [emit/flow/pointsRender/billboards]
  → blur → o0; `navierStokes(read o0)` → palette/lighting/adjust → bloom/lens/vignette → o1) —
  matches at `max-abs-diff=0.000` at every 5s sample across 1800 frames.
- **Live corpus: 81/88 byte-identical** (`npm run parity`, `worst max-abs-diff=0`) — the public
  noisedeck gallery fetched program-for-program (`parity/fetch-corpus.mjs`) and run through the
  time-series harness. Real emergent/stateful programs (kaleido, reaction-diffusion, 3D lit
  volumes, attractors, particle→navier-Stokes chains). The remaining 7 use **custom community
  effects not in the published CDN catalog** (`Unknown effect`) — out of scope, not a parity miss.
- **Stateful/continuous: bit-exact** (`parity/sweep-stateful.sh`) — 2D `navierStokes`,
  `convolutionFeedback`, `temporalAberration`, `reactionDiffusion`, `cellularAutomata`, `feedback`;
  3D `cellularAutomata3d`, `reactionDiffusion3d`, `flow3d`.
- **External-input effects** (`scope`, `spectrum`, `media`, `meshLoader`/`meshRender`):
  byte-identical with deterministic injected inputs (see below).

The parity harness (`parity/timeseries.mjs`) drives the GOLDEN (the CDN engine's own `WebGL2Backend`)
and the CANDIDATE (`ThreeBackend`) from the **same** engine with an identical deterministic time
sequence, then diffs each captured frame — the fair test for stateful effects (it confirms even
`reactionDiffusion` is bit-exact on our ANGLE/Metal driver, which the sibling Metal-vs-Vulkan ports
skip).

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

**183/184 of the published catalog are byte-identical** — 178 via live parity (corpus + sweeps +
per-effect programs) plus the 5 external-input effects above fed deterministic synthetic inputs. The
one effect *not* covered is **`filter/text`** (see [Not included in this pass](#not-included-in-this-pass)).

The external-input *binding/upload* infrastructure exists (`setExternalTexture`,
`updateTextureFromSource`, `uploadDataTexture`, pipeline `setAudioState`) — only the live
data acquisition is out of scope.

### Not included in this pass

Coverage is measured against the **published 184-effect catalog**
(`vendor/noisemaker/effects/manifest.json`). The following are **not** in the
byte-identical-via-live-parity set:

**1 effect with no parity coverage:**
- **`filter/text`** — rasterizes a string through Canvas2D fonts. Unlike the host-input effects
  below, no deterministic-injection fixture was built for it, glyph rendering is OS/font-dependent,
  and **no corpus program calls `text()`** — so it is neither corpus-exercised nor injected here.
  **Untested.** (The sibling Babylon port also drops `text`.)

**5 effects verified ONLY with deterministic injected inputs** (the live host-data path is not
exercised — these confirm the binding/upload + shader path, not data acquisition):
- **`synth/scope`, `synth/spectrum`** (audio) — fed a synthetic 128-sample waveform/spectrum via
  `setAudioState`; no live `AnalyserNode`/mic decode.
- **`synth/media`** (image/video) — fed a synthetic 1024² canvas via `updateTextureFromSource`; no
  live `<video>`/camera/image-URL decode.
- **`render/meshLoader`, `render/meshRender`** (OBJ) — fed a precomputed cube via `uploadMeshData`;
  the engine's `parseOBJ` is **internal-only in the published bundle (not exported)**, so loading a
  real `.obj` URL is not reachable through the adapter.

**Corpus programs using effects outside the catalog** (the 81/88 → 7 misses): 7 gallery programs
fail to compile (`Unknown effect`) because they use **custom community effects not published to the
CDN catalog** — `chromeicosahedroninterior` (5 programs) and `vaporwaveflyover` (2). Out of scope,
not a parity miss. (`osc`, `vec3`, `from`, … are DSL ops / expression builtins and compile fine.)

**Capability limitation — param aliases:** `registerParamAliases` is internal-only in the published
bundle (not exported), so the adapter accepts the **canonical** argument names the noisedeck UI
emits, not alternate aliases (e.g. `backgroundColor`→`bgColor`). The live corpus is unaffected.

### Follow-up work
- **`text` parity** — build a deterministic fixture (fixed glyphs / pre-rasterized atlas), or gate
  it with SSIM instead of byte-equality to absorb font-raster variance across machines.
- **Live host inputs** — wire real feeds for `scope`/`spectrum` (`AnalyserNode`), `media`
  (`<video>`/image element), and `meshLoader` (fetch + parse OBJ — needs `parseOBJ` exported
  upstream, or a small local OBJ parser).
- **Param aliases** — add a local alias map (or consume `registerParamAliases` if a future CDN
  bundle exports it) so alternate arg names resolve.
- **Corpus 88/88** — reached automatically if `chromeicosahedroninterior` + `vaporwaveflyover` are
  ever published to the CDN catalog.

### Done since first cut — **183/184 funcs bit-exact**
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

### Infrastructure status (see `docs/IMPLEMENTATION-PLAN.md`)
- Backend features (MRT mixed-format, points/billboards, additive blend, `uploadDataTexture`,
  std140 UBO): **done.** ✅
- 3D volumes + cubemaps for `synth3d`/`filter3d`/`render`: **done** (2D-flattened atlases
  raymarched in-shader; no real `createTexture3D`/GL-cubemaps needed). ✅
- Integration trio (`NoisemakerCanvas`/`NoisemakerTexture`/`NoisemakerPass`): **done.** ✅
- `loopBegin`/`loopEnd` accumulator parity: **done** (corpus-validated, 10 programs). ✅
- **blaster.noisedeck.app** corpus validation: **done** (81/88; the 7 misses are out-of-catalog
  custom effects). ✅
- Open items (live external-input decoding, `text`, param aliases) are tracked in
  [Follow-up work](#follow-up-work) above.

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

The repo contains only the adapter; the reference engine is **not committed**. Fetch the published
engine from the CDN once (into the git-ignored `vendor/`), then test:

```bash
npm install            # three (pinned) + dev tooling
npm run vendor         # fetch engine + effect mini-bundles from shaders.noisedeck.app -> vendor/ (git-ignored)
npm test               # capability gate, compiler-on-CDN-engine, three resources
```

`npm test` and the parity harness need that fetched engine (the adapter has nothing to drive
without it). Parity uses a dual-backend **time-series** harness — it drives the GOLDEN (the engine's
own `WebGL2Backend`) and the CANDIDATE (`ThreeBackend`) from the **same** CDN engine with an
identical deterministic time sequence, then diffs each captured frame.

```bash
python3 -m venv parity/.venv && parity/.venv/bin/pip install -r parity/requirements.txt   # numpy+Pillow
node parity/timeseries.mjs parity/programs/scope.dsl --frames 4 --capture 2 --loop 4      # one program
npm run parity                                                                            # full live corpus
bash parity/sweep-stateful.sh                                                             # continuous sims
```

External-input effects (scope/spectrum/media/mesh) get a deterministic synthetic input via a
`<name>.inject.json` sidecar, applied identically to both backends (see `parity/page-timeseries.html`).

## Layout

```
src/
  index.js                      public API
  engine-browser.js             loads the CDN engine bundle + effect mini-bundles (browser)
  backend/three-backend.js      ThreeBackend extends Backend  (the work)
  backend/three-resources.js    RT/format/geometry helpers
  runtime/create-three-pipeline.js
  integration/canvas.js         NoisemakerCanvas (+ texture.js / pass.js)
  effects/register-effect.js    shared effect registration (Node + browser)
vendor/
  fetch.sh                      fetch the engine from the CDN          (committed)
  engine.mjs                    Node loader: DOM shim + boot + register (committed)
  noisemaker/**                 fetched engine bytes                   (GIT-IGNORED, never committed)
parity/                         time-series harness, compare.py, programs, live corpus
docs/                           design spec + implementation plan
reference/                      engine-agnostic specs (shared with sibling ports)
```

## Provenance / status

**This is a thin adapter, not a port.** ~2,900 lines of authored code (`ThreeBackend` ~760,
integration wrappers, parity harness) drive the unmodified noisemaker reference engine (~124k LOC:
compiler + pipeline + every effect + GLSL). The 183/184 byte-identical result follows because it
is the same `#version 300 es` shaders on the same WebGL2 driver the reference uses; the real work
was making the `ThreeBackend` shim faithful. (`filter/text` is the lone uncovered effect — see
[Not included in this pass](#not-included-in-this-pass).)

**The reference engine is never committed to this repo** (node_modules posture). `npm run vendor`
(`vendor/fetch.sh`) fetches the published engine from the noisemaker CDN —
`https://shaders.noisedeck.app/1/noisemaker-shaders-core.esm.js` (the engine bundle; exports
`Backend`, `Pipeline`, `compileGraph`, `WebGL2Backend`, … so `ThreeBackend` is injected into the
reference `Pipeline`) plus `…/1/effects/<ns>/<effect>.js` (per-effect mini-bundles, GLSL inline) —
into the **git-ignored** `vendor/noisemaker/`. Only the fetch script + the loaders
(`vendor/engine.mjs` for Node behind a DOM shim, `src/engine-browser.js` for the browser) are
committed; never the engine bytes. The version is pinned in `vendor/fetch.sh` (`VERSION=1`).

Param **aliases** (alt arg names like `backgroundColor`→`bgColor`) are the one capability the
published bundle doesn't expose (`registerParamAliases` is not an export); the adapter accepts the
canonical names the noisedeck UI emits (the live corpus is unaffected).

## License

Released under the MIT License (see [LICENSE](LICENSE)). Use of the Noisemaker and Noise Factor names in derivative products is subject to the [Trademark Policy](TRADEMARK.md).

Copyright © 2026 Noise Factor LLC
