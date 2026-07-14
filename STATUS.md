# noisemaker-three — status & parity

*Last verified 2026-07-14 on Apple Silicon / ANGLE + Metal (WebGL2). The sources of truth are
`parity/sweep-corpus.sh`, `parity/sweep-programs.mjs`, and `parity/timeseries.mjs`.*

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Coverage

**210 effects** across 8 namespaces — the published catalog (`vendor/noisemaker/effects/manifest.json`),
content-pinned to the `/1` CDN build tagged `1a29d431` (2026-07-14T19:47:07.486Z). 25 new `filter`
effects landed since the last sync — the full artistic-filter release: `chrome`, `craquelure`,
`directionalBlur`, `extrude`, `halftone`, `hatch`, `highPass`, `lensFlare`, `median`, `morphology`,
`mosaicTiles`, `oilPaint`, `patchwork`, `photocopy`, `plasticWrap`, `pondRipples`, `relief`, `scatter`,
`spinBlur`, `stamp`, `stipple`, `strokes`, `unsharpMask`, `watercolor`, `wind`. 12 previously-existing
mini-bundles changed content in the same sync: `dither`, `edge`, `emboss`, `grain`, `invert`, `lowPoly`,
`parallax`, `temporalAberration`, `texture` (`filter`); `channelCombine` (`mixer`); `mandala`,
`sacredGeometry` (`synth`).
**209 of 210 render byte-identical** to the reference engine; the one exception is `filter/text`
(unchanged from prior rounds — see [Known limits](#known-limits)).

| Namespace | Effects | Parity |
|---|---|---|
| `synth` | 29 | byte-identical (`scope` / `spectrum` / `media` via injected input) |
| `filter` | 116 | byte-identical (115; `text` untested) |
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

## Mode coverage

Verifying an effect once, at its defaults, is not enough when that effect has a **compile-time
`MODE`/`define`-selected** variant — a parameter whose GLSL branch is baked in at shader-compile
time (`globals.<param>.define` in the vendored definition), not just a runtime uniform. Each such
variant is a genuinely different compiled shader program; an adapter can mis-cache or mis-key one of
them in a way a single default-mode fixture would never expose. `parity/sweep-programs.mjs` is the
gate: every `(effect, mode)` pair below gets its own fixture under `parity/programs/`, one PNG-diff
per pair, `max-abs-diff` required to be **exactly 0** — not tolerance-gated.

The enumeration comes from the vendored effect definitions' own `globals.*.choices` (`getEffect(...).globals`,
queried directly off the fetched mini-bundles), cross-checked against the reference repo's own mode
tests (`test_artistic_effect_release.mjs`, `test_corrective_mode_variants.mjs` — read for orientation
only, never vendored from; this adapter's actual execution path is 100% the fetched CDN bundle).

| Effect | Mode axis | Values proven |
|---|---|---|
| `filter/texture` | `mode` (define) | 15/15 — `canvas`, `crosshatch`, `halftone`, `paper`, `stucco`, `regular`, `soft`, `sprinkles`, `clumped`, `contrasty`, `enlarged`, `stippled`, `horizontal`, `vertical`, `speckle` |
| `filter/strokes` | `mode` (define) | 5/5 — `angled`, `sprayed`, `dark`, `sumiE`, `smudge` |
| `filter/hatch` | `mode` (define) | 6/6 — `pen`, `charcoal`, `chalkCharcoal`, `conte`, `crosshatch`, `coloredPencil` (+ `direction` cross-check) |
| `filter/halftone` | `mode` × `pattern` (both define) | 4/4 compiled variants — `color`; `mono`×{`dot`,`line`,`circle`} |
| `filter/oilPaint` | `mode` (define) | 6/6 — `facet`, `daubs`, `dryBrush`, `fresco`, `knife`, `sponge` |
| `filter/relief` | `mode` (define) | 3/3 — `basRelief`, `plaster`, `notePaper` |
| `filter/stipple` | `mode` (define) | 5/5 — `pointillize`, `mezzoDots`, `mezzoLines`, `mezzoStrokes`, `reticulation` |
| `filter/mosaicTiles` | `mode` (define) | 2/2 — `mosaic`, `shifted` |
| `filter/morphology` | `shape` (define) × `mode` (uniform) | 4/4 — {`dilate`,`erode`}×{`square`,`round`} |
| `filter/extrude` | `type` × `depthSource` (both define) | 4/4 — {`blocks`,`pyramids`}×{`luminance`,`random`} |
| `filter/lensFlare` | `lensType` (define) | 4/4 — `zoom50_300`, `prime35`, `prime105`, `moviePrime` |
| `filter/scatter` | `mode` (define) | 5/5 — `normal`, `darkenOnly`, `lightenOnly`, `anisotropic`, `clumped` |
| `filter/wind` | `method` (define) × `direction` (uniform) | 3/3 method, full 6-combo cross with direction |
| `filter/pondRipples` | `style` × `wrap` (both define) | 3/3 style (default wrap) + 3/3 wrap (default style) |
| `filter/lowPoly` | `mode` (uniform); `borderWidth`/`lightIntensity` (define) | 4/4 modes + both extra compile branches (border-on, light-on) |
| `filter/emboss` | `style` (define) | 2/2 — `color`, `gray` |
| `filter/invert` | `mode` (uniform) | 2/2 — `full`, `solarize` |
| `filter/edge` | `kernel` (uniform) | 3/3 — `fine`, `bold`, `contour` |
| `filter/directionalBlur`, `plasticWrap`, `spinBlur` | none (no compile-time mode) | default + 1 extra param combination each, matching the reference's own smoke-test cases |
| `filter/chrome`, `craquelure`, `highPass`, `median`, `patchwork`, `photocopy`, `stamp`, `unsharpMask`, `watercolor` | none (no compile-time mode) | default only |

`filter/grain` — flagged in this round's brief as having "~10 types," but the vendored definition
has exactly two globals (`alpha`, `pause`), neither a `define`; the reference's own release test
(`test_artistic_effect_release.mjs`) lists `grain` under `extendedEffects` with no mode-specific
cases either. No mode dimension exists to test — documented here as a discrepancy, not a gap.

**112 new fixtures, all byte-exact.** `parity/programs/` is now 300 files (was 188). Full ledger —
every `(effect, mode)` fixture, its `max-abs-diff`, and its golden/candidate PNG paths — regenerate
with `node parity/sweep-programs.mjs` (writes `parity/out/mode-ledger.json`, gitignored scratch like
`CORPUS.txt`).

## Parity

- **Hero integration test: pixel-perfect over a full 30s run.** `parity/integration/hero.dsl` — a
  complex emergent program (3D perlin → 1M-agent flow field → blur → o0; `navierStokes(read o0)` →
  palette/lighting/adjust → bloom/lens/vignette → o1) — matches at `max-abs-diff=0.000` at every 5s
  sample across 1800 frames.
- **Full roster + mode sweep: 299/300 byte-identical** (`node parity/sweep-programs.mjs`, worst
  `max-abs-diff=0` outside the one known exception) — one fixture per effect, plus one per
  compile-time mode variant (see [Mode coverage](#mode-coverage)). The one non-zero result is
  `filter/text`, the same pre-existing, documented font-rendering exception.
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
  vertices from the mesh textures by `gl_VertexID`). `max-abs-diff=0.000` — including at the very
  first rendered frame after injection: `uploadMeshData` lands outside the normal pass-graph write
  path, so (on both backends) it takes one `pipeline.render()` for meshRender's `count: input` to
  pick up the freshly-uploaded vertex count. The harness now primes with one throwaway render after
  mesh injection, before the captured sequence starts — matching the reference's own test convention
  of always rendering twice before asserting anything (see e.g. `test_artistic_effect_release.mjs`'s
  `renderDsl`, which calls `renderer.render(t); renderer.render(t)` unconditionally). Audio/image
  injection has no such settle frame and was already bit-exact at frame 1.

The binding/upload infrastructure exists (`setExternalTexture`, `updateTextureFromSource`,
`uploadDataTexture`, pipeline `setAudioState`) — only live data acquisition is out of scope.

## Known limits

Coverage is measured against the published 210-effect catalog.

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
  `vaporwaveflyover` (2). Unchanged from the prior sync. Out of scope, not a parity miss. (`osc`,
  `vec3`, `from`, … are DSL ops / expression builtins and compile fine.)
- **Mode coverage is scoped to compile-time `define`-selected params** (the architectural risk the
  mission targeted: different `MODE` values compile genuinely different shader programs, which is
  exactly what an adapter can mis-cache). Effects also carry many ordinary runtime-uniform enums
  (blend modes, palettes, wrap modes, curve types, …) that select among values within a *single*
  compiled program; those are exercised by the existing default-parameter fixtures (if a uniform were
  mishandled, the default case would already show a diff) and were not separately enumerated per
  choice — doing so exhaustively (e.g. the 56-entry shared palette enum, reused across ~8 effects)
  would not test anything the define-mode sweep and the default fixtures don't already cover.
- **Platform.** Verified on Apple Silicon / ANGLE + Metal (WebGL2).

## Follow-up work

- **`text` parity** — build a deterministic fixture (fixed glyphs / pre-rasterized atlas), or gate it
  with SSIM instead of byte-equality to absorb font-raster variance across machines.
- **Live host inputs** — wire real feeds for `scope`/`spectrum` (`AnalyserNode`), `media`
  (`<video>`/image element), and `meshLoader` (fetch + parse OBJ — needs `parseOBJ` exported
  upstream, or a small local OBJ parser).
- **Param aliases** — add a local alias map (or consume `registerParamAliases` if a future CDN bundle
  exports it) so alternate arg names resolve.
- **Corpus 88/88** — reached automatically if the remaining unpublished community effects are ever
  published to the CDN catalog.
- **Unpublished-delta blocker: CLOSED this round.** The prior sync (2026-07-09) flagged upstream
  running well ahead of what `/1` served — on the order of twenty artistic filters plus engine fixes.
  This sync's `bash vendor/fetch.sh` pulled all of it: the CDN republished **in place** at `/1`
  (210 effects, build `1a29d431`), so there is no acquisition gap left to track. `vendor/fetch.sh`
  remains the only ingestion path (by design) and will pick up future publishes the same way.
