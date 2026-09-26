# noisemaker-for-threejs: compatibility report

## 1. Source and authority revisions

Daily review: 2026-09-25. Current inspected source: [`05f599274ed11e6d0778b7a21978f058f2b47c06`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/05f599274ed11e6d0778b7a21978f058f2b47c06).
Full rendered parity remains **unverified**. No release approval or new closure follows from this review.
Current upstream discovery: `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.
The observations below retain their original source and authority identities. They do not qualify later updates.
Current served kit: `0.1.5`, source `815d35fb3365d66a078f0eee155b14709e9ae9f2`. [Retrieved inventory and hashes](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/current-served-inventories.json). Artifact identity does not establish host qualification.

### Earlier source observations

Report date: 2026-09-24. Source inspected: [`815d35fb3365d66a078f0eee155b14709e9ae9f2`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/815d35fb3365d66a078f0eee155b14709e9ae9f2).
Full rendered parity at this SHA: **unverified**. This is not a release approval.
A later documentation-only commit does not change this tested source identity.
Any runtime, package, or authority update requires fresh evidence before this report can qualify it.

Three.js WebGL2 adapter with texture, canvas, and EffectComposer entry points. The declared peer range begins at Three.js 0.160. [Source contract](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md).

The vendor fetch uses the published CDN engine. STATUS records successive revisions, but fetched files remain outside the repository.
Current upstream discovery SHA: `c9ee8a049b2b63cd300da67c01ee40baf29dc288`.
Published authority: `1.0.176`, source `c9ee8a049b2b63cd300da67c01ee40baf29dc288`.
[Immutable published manifest](https://shaders.noisedeck.app/1.0.176/effects/manifest.json) contains 210 effect IDs.
Its SHA-256 is `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`.
These IDs do not define complete parameter, state, input, or platform coverage.

Served kit `0.1.5` records `815d35fb3365d66a078f0eee155b14709e9ae9f2`. [Source metadata](https://kits.noisedeck.app/threejs/0/deployment-meta.json).
Historical measurements remain bound to their original revisions in [completion gaps](COMPLETION_GAPS.md).

## 2. Host and distribution matrix

Current tests and qualification limits are in [section 3](#3-parity-coverage).
The matrix below retains the earlier measured scope. A historical verified row is not a current-source or full-platform certification.

| Dimension | Status | Measured scope or limit |
|---|---|---|
| Source-level checks | verified | 51 Node tests passed. The full browser image sweep and installed consumer workflow were not executed. |
| Actual host rendering | unverified | No new complete native or browser workflow qualified by this report. |
| Minimum and current host versions | unverified | Declared requirements are not a tested version matrix. |
| Supported operating systems and backends | unverified | This pass does not establish Windows, Linux, and macOS coverage. |
| Installed package and first useful result | unverified | Complete isolated installation was not qualified for this source. |
| Parameters, external inputs, state, and chains | unverified | Full current-authority combinations remain unmeasured. |
| Invalid input and recovery | unverified | Unit checks do not establish every installed public entry point. |
| Upgrade, removal, and resource cleanup | unverified | Prior defects and missing workflows remain in the gap register. |
| Accessibility of provided controls | unverified | Keyboard, focus, labels, and diagnostics need host observations where applicable. |
| Release readiness | blocked | Full parity, installation, host, and artifact evidence remain incomplete. |

## 3. Parity coverage

### Daily review, 2026-09-25

65 unit tests pass and the packed artifact contains 465 files. Neither result establishes complete browser rendering or a consumer install across the declared Three.js peer range. The prior compatibility measurements remain historical. GAP-001 remains open. Current full parity is stale and unverified. [Raw evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json). (Superseded 2026-09-26 — see "Current authority qualification" below; GAP-001 is closed there.)

The current full case denominator remains incomplete. Missing parameters, hosts, external inputs, and stateful sequences remain qualification gaps. No skip or tolerated difference counts as exact parity.

### Current authority qualification, 2026-09-26 — GAP-001 closed

Rendered parity for the current published authority is measured, not stale. Authority inputs: CDN `/1` bundle 858616 bytes, SHA-256 `092c3b776003bc1539bed91aa86f421f839b40b1aa8b81ea09a5ec5e6b7bd3c7`; manifest SHA-256 `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e` (210/210 mini-bundles); identified as upstream `v1.0.183` = `8eeb7b5a` (CDN Last-Modified 2026-09-25T22:45:29Z, 18 minutes after the tag). Full raw sweep output and every case/parameter/exclusion/error/tolerance are recorded in STATUS.md's "Full qualification 2026-09-26" entry:

| Gate | Expected cases | Executed | Strict passes | Failures | Skips | Status |
|---|---|---|---|---|---|---|
| Programs + mode sweep (`sweep-programs.mjs`, frames=1) | 304 | 304 | 304 (worst max-abs-diff=0) | 0 | 0 | verified |
| Stateful sweep (`sweep-stateful.sh`, frames=30 capture=15) | 13 | 13 | 13 bit-exact (worst=0) | 0 | 0 | verified |
| Corpus sweep (`npm run parity`, frames=20 capture=10, all 88 fetched programs) | 88 | 88 | 81 (worst=0) | 0 | 0 | verified — 7 ERR rows identified: 5 × `chromeicosahedroninterior`, 2 × `vaporwaveflyover` (golden-side S001, unpublished community effects; denominator 81+7=88 unchanged) |
| Compiler gate (`npm test`) | 66 | 66 | 66 | 0 | 0 | verified (exit 0) |

Environment: Linux container, Chrome Headless Shell 149.0.7827.55 (playwright chromium-headless-shell v1228), SwiftShader; platform scope (Apple Silicon/Metal) remains as documented in STATUS Known limits. `filter/text` remains the one untested effect (OS font rasterization). Live external inputs remain injected-only. These limits do not reduce any denominator above.

### Earlier measurements

Full parity requires complete applicable coverage with no skips or missing cases.
Historical NEAR, CHAOS, and tolerated differences do not count as strict equality.
The existing numerical contracts remain separate from exact comparison. This report does not change tolerances or goldens.
Unknown values mean `not measured`, never zero.

| Gate | Expected cases | Executed | Strict passes | Failures | Skips | Status |
|---|---|---|---|---|---|---|
| Current full render suite | not measured | not measured | not measured | not measured | not measured | unverified |

The served compatibility manifest declares mode `all`. That declaration covers the authority catalog but does not prove behavior.
No missing ID conclusion follows without reconciling fixture behavior and the source contract.
Missing effects remain visible toward the full-parity goal. Contract exclusions do not become successful tests.

### Effect inventory

| Effect ID | Served declaration | Current full parity |
|---|---|---|
| `classicNoisedeck/bitEffects` | all | unverified |
| `classicNoisedeck/caustic` | all | unverified |
| `classicNoisedeck/cellNoise` | all | unverified |
| `classicNoisedeck/cellRefract` | all | unverified |
| `classicNoisedeck/coalesce` | all | unverified |
| `classicNoisedeck/colorLab` | all | unverified |
| `classicNoisedeck/composite` | all | unverified |
| `classicNoisedeck/effects` | all | unverified |
| `classicNoisedeck/fractal` | all | unverified |
| `classicNoisedeck/glitch` | all | unverified |
| `classicNoisedeck/kaleido` | all | unverified |
| `classicNoisedeck/lensDistortion` | all | unverified |
| `classicNoisedeck/moodscape` | all | unverified |
| `classicNoisedeck/noise` | all | unverified |
| `classicNoisedeck/noise3d` | all | unverified |
| `classicNoisedeck/refract` | all | unverified |
| `classicNoisedeck/shapeMixer` | all | unverified |
| `classicNoisedeck/shapes` | all | unverified |
| `classicNoisedeck/shapes3d` | all | unverified |
| `classicNoisedeck/splat` | all | unverified |
| `filter/adjust` | all | unverified |
| `filter/bloom` | all | unverified |
| `filter/blur` | all | unverified |
| `filter/bulge` | all | unverified |
| `filter/celShading` | all | unverified |
| `filter/channel` | all | unverified |
| `filter/chroma` | all | unverified |
| `filter/chromaticAberration` | all | unverified |
| `filter/chrome` | all | unverified |
| `filter/clouds` | all | unverified |
| `filter/colorReplace` | all | unverified |
| `filter/convolutionFeedback` | all | unverified |
| `filter/corrupt` | all | unverified |
| `filter/craquelure` | all | unverified |
| `filter/crt` | all | unverified |
| `filter/degauss` | all | unverified |
| `filter/deriv` | all | unverified |
| `filter/directionalBlur` | all | unverified |
| `filter/dither` | all | unverified |
| `filter/edge` | all | unverified |
| `filter/emboss` | all | unverified |
| `filter/extrude` | all | unverified |
| `filter/feedback` | all | unverified |
| `filter/fibers` | all | unverified |
| `filter/flipMirror` | all | unverified |
| `filter/fxaa` | all | unverified |
| `filter/glowingEdge` | all | unverified |
| `filter/glyphMap` | all | unverified |
| `filter/grade` | all | unverified |
| `filter/grain` | all | unverified |
| `filter/grime` | all | unverified |
| `filter/halftone` | all | unverified |
| `filter/hatch` | all | unverified |
| `filter/highPass` | all | unverified |
| `filter/historicPalette` | all | unverified |
| `filter/invert` | all | unverified |
| `filter/lens` | all | unverified |
| `filter/lensFlare` | all | unverified |
| `filter/lensWarp` | all | unverified |
| `filter/lightLeak` | all | unverified |
| `filter/lighting` | all | unverified |
| `filter/lowPoly` | all | unverified |
| `filter/median` | all | unverified |
| `filter/morphology` | all | unverified |
| `filter/mosaicTiles` | all | unverified |
| `filter/motionBlur` | all | unverified |
| `filter/normalMap` | all | unverified |
| `filter/normalize` | all | unverified |
| `filter/octaveWarp` | all | unverified |
| `filter/oilPaint` | all | unverified |
| `filter/osd` | all | unverified |
| `filter/outline` | all | unverified |
| `filter/palette` | all | unverified |
| `filter/parallax` | all | unverified |
| `filter/patchwork` | all | unverified |
| `filter/photocopy` | all | unverified |
| `filter/pinch` | all | unverified |
| `filter/pixelSort` | all | unverified |
| `filter/pixels` | all | unverified |
| `filter/plasticWrap` | all | unverified |
| `filter/polar` | all | unverified |
| `filter/pondRipples` | all | unverified |
| `filter/posterize` | all | unverified |
| `filter/prismaticAberration` | all | unverified |
| `filter/reindex` | all | unverified |
| `filter/relief` | all | unverified |
| `filter/repeat` | all | unverified |
| `filter/reverb` | all | unverified |
| `filter/ridge` | all | unverified |
| `filter/rotate` | all | unverified |
| `filter/scale` | all | unverified |
| `filter/scanlineError` | all | unverified |
| `filter/scatter` | all | unverified |
| `filter/scratches` | all | unverified |
| `filter/scroll` | all | unverified |
| `filter/seamless` | all | unverified |
| `filter/sharpen` | all | unverified |
| `filter/simpleAberration` | all | unverified |
| `filter/sine` | all | unverified |
| `filter/skew` | all | unverified |
| `filter/smooth` | all | unverified |
| `filter/smoothstep` | all | unverified |
| `filter/snow` | all | unverified |
| `filter/sobel` | all | unverified |
| `filter/spatter` | all | unverified |
| `filter/spinBlur` | all | unverified |
| `filter/spiral` | all | unverified |
| `filter/spookyTicker` | all | unverified |
| `filter/stamp` | all | unverified |
| `filter/step` | all | unverified |
| `filter/stipple` | all | unverified |
| `filter/strayHair` | all | unverified |
| `filter/strokes` | all | unverified |
| `filter/temporalAberration` | all | unverified |
| `filter/tetraColorArray` | all | unverified |
| `filter/tetraCosine` | all | unverified |
| `filter/text` | all | unverified |
| `filter/texture` | all | unverified |
| `filter/threshold` | all | unverified |
| `filter/tile` | all | unverified |
| `filter/tint` | all | unverified |
| `filter/translate` | all | unverified |
| `filter/tunnel` | all | unverified |
| `filter/unsharpMask` | all | unverified |
| `filter/vaseline` | all | unverified |
| `filter/vignette` | all | unverified |
| `filter/warp` | all | unverified |
| `filter/watercolor` | all | unverified |
| `filter/waves` | all | unverified |
| `filter/wind` | all | unverified |
| `filter/wobble` | all | unverified |
| `filter/wormhole` | all | unverified |
| `filter/zoomBlur` | all | unverified |
| `filter3d/flow3d` | all | unverified |
| `filter3d/palette3d` | all | unverified |
| `mixer/alphaMask` | all | unverified |
| `mixer/applyMode` | all | unverified |
| `mixer/blendMode` | all | unverified |
| `mixer/cellSplit` | all | unverified |
| `mixer/centerMask` | all | unverified |
| `mixer/channelCombine` | all | unverified |
| `mixer/distortion` | all | unverified |
| `mixer/focusBlur` | all | unverified |
| `mixer/mashup` | all | unverified |
| `mixer/patternMix` | all | unverified |
| `mixer/shadow` | all | unverified |
| `mixer/shapeMask` | all | unverified |
| `mixer/split` | all | unverified |
| `mixer/thresholdMix` | all | unverified |
| `mixer/uvRemap` | all | unverified |
| `points/attractor` | all | unverified |
| `points/buddhabrot` | all | unverified |
| `points/dla` | all | unverified |
| `points/flock` | all | unverified |
| `points/flow` | all | unverified |
| `points/heightGrid` | all | unverified |
| `points/hydraulic` | all | unverified |
| `points/lenia` | all | unverified |
| `points/life` | all | unverified |
| `points/physarum` | all | unverified |
| `points/physical` | all | unverified |
| `render/loopBegin` | all | unverified |
| `render/loopEnd` | all | unverified |
| `render/meshLoader` | all | unverified |
| `render/meshRender` | all | unverified |
| `render/pointsBillboardRender` | all | unverified |
| `render/pointsEmit` | all | unverified |
| `render/pointsRender` | all | unverified |
| `render/render3d` | all | unverified |
| `render/renderCubemap3d` | all | unverified |
| `render/renderCubemapSurface` | all | unverified |
| `render/renderLandscape3d` | all | unverified |
| `render/renderLit3d` | all | unverified |
| `synth/bitwise` | all | unverified |
| `synth/cell` | all | unverified |
| `synth/cellularAutomata` | all | unverified |
| `synth/curl` | all | unverified |
| `synth/gabor` | all | unverified |
| `synth/gradient` | all | unverified |
| `synth/julia` | all | unverified |
| `synth/mandala` | all | unverified |
| `synth/mandelbrot` | all | unverified |
| `synth/media` | all | unverified |
| `synth/mnca` | all | unverified |
| `synth/modPattern` | all | unverified |
| `synth/navierStokes` | all | unverified |
| `synth/newton` | all | unverified |
| `synth/noise` | all | unverified |
| `synth/osc2d` | all | unverified |
| `synth/pattern` | all | unverified |
| `synth/perlin` | all | unverified |
| `synth/polygon` | all | unverified |
| `synth/reactionDiffusion` | all | unverified |
| `synth/remap` | all | unverified |
| `synth/roll` | all | unverified |
| `synth/sacredGeometry` | all | unverified |
| `synth/scope` | all | unverified |
| `synth/shape` | all | unverified |
| `synth/solid` | all | unverified |
| `synth/spectrum` | all | unverified |
| `synth/subdivide` | all | unverified |
| `synth/testPattern` | all | unverified |
| `synth3d/cell3d` | all | unverified |
| `synth3d/cellularAutomata3d` | all | unverified |
| `synth3d/flythrough3d` | all | unverified |
| `synth3d/fractal3d` | all | unverified |
| `synth3d/heightmap3d` | all | unverified |
| `synth3d/noise3d` | all | unverified |
| `synth3d/reactionDiffusion3d` | all | unverified |
| `synth3d/shape3d` | all | unverified |

## 4. Evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-threejs-remote-evidence.json).

[Bounded test evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents/threejs-tests.json). [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-threejs/actions?query=head_sha%3A815d35fb3365d66a078f0eee155b14709e9ae9f2).
[This run evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents) retains commands, exit codes, source identities, and distribution metadata.
Official ecosystem reference: [Current Three.js manual, accessed 2026-09-24](https://threejs.org/manual/en/installation.html).
Source CI, export dispatch, artifact delivery, and rendered parity are separate evidence dimensions.
A successful dispatch or unit-test summary does not establish a full rendered gate.

## 5. Open compatibility limits

Next bounded check: Install the npm tarball in an isolated consumer at the declared Three.js floor and current supported version. Exercise texture, canvas, and EffectComposer entry points with a useful rendered graph. Compare the same immutable reference cases, then test resize, disposal, invalid-input recovery, and an external texture.
See the stable entries in [completion gaps](COMPLETION_GAPS.md).

See [GAP-001 and the complete gap register](COMPLETION_GAPS.md#4-known-gaps) for evidence, dependencies, and acceptance criteria.

1. Reconcile the current authority and complete case inventory, including parameters, inputs, stateful frames, and host versions.
2. Run the existing actual-renderer suite without skip options. Record every missing, failed, refused, or timed-out case.
3. Verify installation, useful output, errors, recovery, upgrades, and removal with the actual distribution.
4. Inspect exact-source CI and retain artifact hashes. Keep unresolved qualification failed or unverified.

All eligible ports have equal priority. Full parity and zero skipped cases remain the goal.
Implementation corrections remain with the separate job. This report does not advance the parity checkpoint.

## 6. History

2026-09-25 daily review at `05f599274ed11e6d0778b7a21978f058f2b47c06`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json). No new closure claimed.

| Date | Source | Result | Change |
|---|---|---|---|
| 2026-09-24 | `815d35fb3365d66a078f0eee155b14709e9ae9f2` | Full qualification unverified | Created the requested maintained compatibility report. Preserved historical evidence and open gaps. |

Run: `20260924-remaining-gap-documents`. Later audits and reviews update this report with source-bound results.
