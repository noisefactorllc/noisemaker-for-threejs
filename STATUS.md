# noisemaker-three — status & parity

*Last verified 2026-07-09 on Apple Silicon / ANGLE + Metal (WebGL2). The sources of truth are
`parity/sweep-corpus.sh` and `parity/timeseries.mjs`.*

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Coverage

**185 effects** across 8 namespaces — the published catalog (`vendor/noisemaker/effects/manifest.json`;
`filter/parallax` new since the last sync).
**184 of 185 render byte-identical** to the reference engine; the one exception is `filter/text`
(see [Known limits](#known-limits)).

| Namespace | Effects | Parity |
|---|---|---|
| `synth` | 29 | byte-identical (`scope` / `spectrum` / `media` via injected input) |
| `filter` | 91 | byte-identical (90; `text` untested) |
| `mixer` | 15 | byte-identical |
| `classicNoisedeck` | 20 | byte-identical (meta/param effects: `composite`, `kaleido`, `refract`, …) |
| `points` / `render` | 10 / 11 | byte-identical (agents via time-series; `meshLoader` / `meshRender` via injected OBJ) |
| `synth3d` / `filter3d` | 7 / 2 | byte-identical (2D-atlas volumes raymarched in-shader; cubemaps via `cubeBasis`) |

Everything in the catalog is exercised, including the pieces that are usually hard to reach:

- **Full 3D namespace** — `synth3d` (×7), `filter3d` (×2), and the 3D renderers `render3d` /
  `renderLit3d` / `renderCubemap3d` / `renderCubemapSurface`. Volumes are 2D-flattened atlases
  raymarched in-shader, so no `createTexture3D` or GL cubemaps are needed; cubemap faces render to a
  2D `rgba16f` target via the `cubeBasis` uniform.
- **`remap` + `mashup`** — std140 UBO support (`uniformLayout`), verified trivial and zoned.
- **`loopBegin` / `loopEnd`** — accumulator-feedback primitives; corpus-validated (10 corpus programs
  use them, all bit-exact).
- **Canvas2D-overlay effects** (`fibers`, `scratches`, `strayHair`) — bit-exact via a raw-GL upload
  matching the reference's `BROWSER_DEFAULT` colorspace (three forces `NONE`).
- **Particle/agent sims** (attractor, buddhabrot, dla, flock, flow, hydraulic, lenia, life,
  physarum, physical) — bit-exact via the time-series harness.
- **Integration wrappers** — `NoisemakerCanvas` (standalone full-screen renderer), `NoisemakerTexture`
  (offscreen program exposed as a stable `THREE.Texture`, sharing the caller's renderer), and
  `NoisemakerPass` (EffectComposer post-process pass; filter mode samples the scene, or generative
  overlay). All three verified pixel-identical (`max-abs-diff=0.000`).

## Parity

- **Hero integration test: pixel-perfect over a full 30s run.** `parity/integration/hero.dsl` — a
  complex emergent program (3D perlin → 1M-agent flow field → blur → o0; `navierStokes(read o0)` →
  palette/lighting/adjust → bloom/lens/vignette → o1) — matches at `max-abs-diff=0.000` at every 5s
  sample across 1800 frames.
- **Live corpus: 81/88 byte-identical** (`npm run parity`, worst `max-abs-diff=0`) — the public
  noisedeck gallery fetched program-for-program (`parity/fetch-corpus.mjs`) and run through the
  harness: real emergent/stateful programs (kaleido, reaction-diffusion, 3D lit volumes, attractors,
  particle → navier-Stokes chains). The remaining 7 use custom community effects not in the published
  catalog — see [Known limits](#known-limits).
- **Stateful / continuous: bit-exact** (`parity/sweep-stateful.sh`) — 2D `navierStokes`,
  `convolutionFeedback`, `temporalAberration`, `reactionDiffusion`, `cellularAutomata`, `feedback`;
  3D `cellularAutomata3d`, `reactionDiffusion3d`, `flow3d`.
- **External-input effects** (`scope`, `spectrum`, `media`, `meshLoader` / `meshRender`):
  byte-identical with deterministic injected inputs (see below).
- **Parity criterion:** `max-abs-diff ≤ 2/255` **and** `SSIM ≥ 0.98`. Every PASS hits `0.000`.

Parity is a true backend-vs-backend diff. The harness (`parity/timeseries.mjs`) drives the GOLDEN
(the CDN engine's own `WebGL2Backend`) and the CANDIDATE (`ThreeBackend`) from the **same** engine
with an identical deterministic time sequence, then diffs each captured frame — the fair test for
stateful effects, since both share the same ANGLE/Metal driver. That's why even `reactionDiffusion`
is bit-exact here, where the sibling Metal-vs-Vulkan ports must chaos-gate it.

### External-input effects — parity via deterministic injected inputs

A live feed (mic, camera, OBJ URL) is nondeterministic, so these effects are tested by injecting a
fixed synthetic input **identically** into golden and candidate (`parity/page-timeseries.html`
`applyInject()`, driven by a `<name>.inject.json` sidecar). This exercises the real binding/upload +
shader path, the same way the rest of the catalog is validated.

- **`scope`, `spectrum`** (audio) — injected 128-sample waveform/spectrum
  (`uniform float audioWaveform[128]` via `setAudioState`). `max-abs-diff=0.000`.
- **`media`** (video/image) — injected 1024² canvas bound to the external `imageTex`
  (`updateTextureFromSource`). `max-abs-diff=0.000`.
- **`meshLoader` / `meshRender`** (OBJ) — injected cube OBJ via `uploadMeshData` (mesh-surface
  textures) plus a `triangles` draw path (depth test + back-face cull; the vertex shader fetches
  vertices from the mesh textures by `gl_VertexID`). `max-abs-diff=0.000`.

The binding/upload infrastructure exists (`setExternalTexture`, `updateTextureFromSource`,
`uploadDataTexture`, pipeline `setAudioState`) — only live data acquisition is out of scope.

## Known limits

Coverage is measured against the published 185-effect catalog.

- **`filter/text` — untested (the lone uncovered effect).** It rasterizes a string through Canvas2D
  fonts. No deterministic-injection fixture was built for it, glyph rendering is OS/font-dependent,
  and no corpus program calls `text()` — so it is neither corpus-exercised nor injected. (The sibling
  Babylon port also drops `text`.)
- **External inputs are injected, not live.** `scope`/`spectrum` have no live `AnalyserNode`/mic
  decode; `media` has no live `<video>`/camera/image-URL decode; `meshLoader`/`meshRender` cannot
  load a real `.obj` URL because the engine's `parseOBJ` is internal-only in the published bundle (not
  exported). The binding/upload + shader path is verified; only the live data acquisition is missing.
- **Param aliases.** `registerParamAliases` is internal-only in the published bundle (not exported),
  so the adapter accepts the **canonical** argument names the noisedeck UI emits, not alternate
  aliases (e.g. `backgroundColor` → `bgColor`). The live corpus is unaffected.
- **Corpus 81/88.** Seven gallery programs fail to compile (`Unknown effect`) because they use custom
  community effects not published to the CDN catalog — `chromeicosahedroninterior` (5 programs) and
  `vaporwaveflyover` (2). Out of scope, not a parity miss. (`osc`, `vec3`, `from`, … are DSL ops /
  expression builtins and compile fine.)
- **Platform.** Verified on Apple Silicon / ANGLE + Metal (WebGL2).

## Follow-up work

- **`text` parity** — build a deterministic fixture (fixed glyphs / pre-rasterized atlas), or gate it
  with SSIM instead of byte-equality to absorb font-raster variance across machines.
- **Live host inputs** — wire real feeds for `scope`/`spectrum` (`AnalyserNode`), `media`
  (`<video>`/image element), and `meshLoader` (fetch + parse OBJ — needs `parseOBJ` exported
  upstream, or a small local OBJ parser).
- **Param aliases** — add a local alias map (or consume `registerParamAliases` if a future CDN bundle
  exports it) so alternate arg names resolve.
- **Corpus 88/88** — reached automatically if `chromeicosahedroninterior` + `vaporwaveflyover` are
  ever published to the CDN catalog.
- **Upstream has a large unpublished delta.** As of this sync, the Noisemaker engine's own
  development is well ahead of what `shaders.noisedeck.app/1` actually serves — on the order of
  twenty more filters (`unsharpMask`, `highPass`, `median`, `morphology`, `directionalBlur`,
  `spinBlur`, `scatter`, `wind`, `pondRipples`, `extrude`, `halftone`, `stipple`, `oilPaint`,
  `watercolor`, `plasticWrap`, `relief`, `photocopy`, `stamp`, `chrome`, `hatch`) plus assorted engine
  fixes, not on the CDN yet. (`filter/parallax` was part of that same batch of work and *did* land on
  `/1` this sync — see Coverage.) Nothing to do here — this adapter has no acquisition path other than
  the published CDN (by design — see `vendor/fetch.sh`), so `bash vendor/fetch.sh` picks up the rest
  automatically whenever a future publish ships them.
