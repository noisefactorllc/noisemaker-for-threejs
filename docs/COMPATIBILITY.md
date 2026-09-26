# noisemaker-for-threejs: compatibility report

## 1. Source and authority revisions

Completion audit: 2026-09-26. Current source: [`1822646f9d6d90a164a5146f4db571eea2b98202`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/1822646f9d6d90a164a5146f4db571eea2b98202).
Tested source: `1822646` (local and remote identical; full suite executed at this SHA).
Served authority: `v1.0.185`, source `6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa`. Served CDN `/1` bundle SHA-256 `8b9f9eee…` (870700 bytes), manifest SHA-256 `05c4d7b7…`, 210/210 mini-bundles.
Freshness: current. The report covers the audited source and the served authority.
Served kit: `0.1.5`, source `815d35fb3365d66a078f0eee155b14709e9ae9f2`, byte-verified 2026-09-26. Kit-relevant source is unchanged through `1822646`.
The npm registry has no `noisemaker-for-threejs` package (HTTP 404). Evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`.

Daily review: 2026-09-26 at [`bbef9990b3515acf16213a6c5a088a9edd702b1c`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/bbef9990b3515acf16213a6c5a088a9edd702b1c). Every gate and both consumer drivers were re-executed, all exit 0. GAP-004 and GAP-005 are recorded in [completion gaps](COMPLETION_GAPS.md). Freshness: current at the review. Evidence: `/series/review-20260926-133500/result.json`.

### Earlier source observations

Daily review: 2026-09-25. Inspected source: [`05f599274ed11e6d0778b7a21978f058f2b47c06`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/05f599274ed11e6d0778b7a21978f058f2b47c06).
Full rendered parity remained unverified at that review. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.

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
| Source-level checks | verified | 2026-09-26 audit at `1822646`: `npm test` 66/66, lint clean, vendor fetch 210/210. |
| Actual host rendering | verified | 2026-09-26 audit at `1822646`: programs 304/304 worst=0, stateful 13 bit-exact, corpus 81+7 identified ERR over 88, Linux/headless SwiftShader. |
| Minimum and current host versions | partial | three.js 0.160.0 (declared peer floor) and 0.171.0 verified in installed consumers (2026-09-26, Linux/headless SwiftShader only); npm `three` latest 0.186.1 and all versions above 0.171.0 remain unmeasured (GAP-004). |
| Supported operating systems and backends | unverified | Linux/headless SwiftShader measured. Windows, macOS, and Apple Silicon/Metal are unmeasured and unavailable in the audit environment (GAP-004, blocked). |
| Installed package and first useful result | verified | Installed-consumer workflow qualified 2026-09-26 on Linux/headless SwiftShader (see STATUS.md "Installed consumer qualification 2026-09-26" and GAP-002). |
| Parameters, external inputs, state, and chains | partial | Full mode roster, stateful sequences, and chains verified. Parameter combinations beyond the roster and live external inputs remain unmeasured. |
| Invalid input and recovery | verified | Invalid-DSL diagnostic (`L004`) and valid-DSL recovery verified through the installed public entry point (2026-09-26). |
| Upgrade, removal, and resource cleanup | partial | In-page dispose verified via three's own resource counters (2026-09-26); kit removal verified and the kit upgrade path recorded (2026-09-26); npm upgrade/removal deliberately deferred with the npm publication decision (GAP-003). |
| Accessibility of provided controls | unverified | Keyboard, focus, labels, and diagnostics need host observations where applicable. |
| Release readiness | supported with limits | GAP-003 closed 2026-09-26: served kit exercised end to end (render, invalid-input diagnosis, removal), hashes/notices/lifecycle recorded, registry decision defined (npm publication deferred to an owner release action; 404 is the expected state until then). Open limits: GAP-004 (platform and host-version qualification, blocked) and GAP-005 (no source-update rendered-parity CI gate; release blocker). |

## 3. Parity coverage

### Completion audit, 2026-09-26 — source `1822646`, authority `v1.0.185`

The full existing suite was executed again at the audited source against the served authority inputs (CDN `/1` bundle SHA-256 `8b9f9eee…`, manifest SHA-256 `05c4d7b7…`, 210/210 mini-bundles). All commands exited 0. Environment: Linux/headless SwiftShader, Chrome Headless Shell 149.0.7827.55.

| Gate | Expected cases | Executed | Strict passes | Failures | Skips | Status |
|---|---|---|---|---|---|---|
| Programs + mode sweep (`sweep-programs.mjs`, frames=1) | 304 | 304 | 304 (worst max-abs-diff=0) | 0 | 0 | verified |
| Stateful sweep (`sweep-stateful.sh`) | 13 | 13 | 13 bit-exact (worst=0) | 0 | 0 | verified |
| Corpus sweep (`npm run parity`, frames=20 capture=10, all 88 fetched programs) | 88 | 88 | 81 (worst=0) | 0 | 0 | verified — 7 ERR rows identified: golden-side S001, unpublished community effects; denominator 81+7=88 unchanged |
| Compiler gate (`npm test`) | 66 | 66 | 66 | 0 | 0 | verified (exit 0) |

Programs denominator: 307 fixtures minus 3 retired historical effects (`bc`, `hs`, `colorspace`) absent from the current 210-effect manifest. The `text` fixture executed and passed in-suite; its font-raster dependence is documented in STATUS Known limits. Live external inputs remain injected-only. These limits do not reduce any denominator above. Raw evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`.

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

Environment: Linux container, Chrome Headless Shell 149.0.7827.55 (playwright chromium-headless-shell v1228), SwiftShader; platform scope (Apple Silicon/Metal) remains as documented in STATUS Known limits. `filter/text` passes in-suite on the same-browser comparison; cross-machine font-raster stability remains unclaimed (STATUS Known limits). Live external inputs remain injected-only. These limits do not reduce any denominator above.

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
| `classicNoisedeck/bitEffects` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/caustic` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/cellNoise` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/cellRefract` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/coalesce` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/colorLab` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/composite` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/effects` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/fractal` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/glitch` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/kaleido` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/lensDistortion` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/moodscape` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/noise` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/noise3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/refract` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/shapeMixer` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/shapes` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/shapes3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `classicNoisedeck/splat` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/adjust` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/bloom` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/blur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/bulge` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/celShading` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/channel` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/chroma` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/chromaticAberration` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/chrome` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/clouds` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/colorReplace` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/convolutionFeedback` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/corrupt` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/craquelure` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/crt` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/degauss` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/deriv` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/directionalBlur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/dither` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/edge` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/emboss` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/extrude` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/feedback` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/fibers` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/flipMirror` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/fxaa` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/glowingEdge` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/glyphMap` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/grade` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/grain` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/grime` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/halftone` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/hatch` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/highPass` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/historicPalette` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/invert` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lens` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lensFlare` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lensWarp` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lightLeak` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lighting` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/lowPoly` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/median` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/morphology` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/mosaicTiles` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/motionBlur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/normalMap` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/normalize` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/octaveWarp` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/oilPaint` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/osd` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/outline` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/palette` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/parallax` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/patchwork` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/photocopy` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/pinch` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/pixelSort` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/pixels` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/plasticWrap` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/polar` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/pondRipples` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/posterize` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/prismaticAberration` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/reindex` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/relief` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/repeat` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/reverb` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/ridge` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/rotate` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/scale` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/scanlineError` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/scatter` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/scratches` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/scroll` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/seamless` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/sharpen` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/simpleAberration` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/sine` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/skew` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/smooth` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/smoothstep` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/snow` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/sobel` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/spatter` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/spinBlur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/spiral` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/spookyTicker` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/stamp` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/step` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/stipple` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/strayHair` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/strokes` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/temporalAberration` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/tetraColorArray` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/tetraCosine` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/text` | all | verified in-suite (2026-09-26 sweep, worst=0); font-raster dependence documented in STATUS Known limits |
| `filter/texture` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/threshold` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/tile` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/tint` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/translate` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/tunnel` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/unsharpMask` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/vaseline` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/vignette` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/warp` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/watercolor` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/waves` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/wind` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/wobble` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/wormhole` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter/zoomBlur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter3d/flow3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `filter3d/palette3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/alphaMask` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/applyMode` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/blendMode` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/cellSplit` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/centerMask` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/channelCombine` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/distortion` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/focusBlur` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/mashup` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/patternMix` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/shadow` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/shapeMask` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/split` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/thresholdMix` | all | verified (2026-09-26 audit sweep, worst=0) |
| `mixer/uvRemap` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/attractor` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/buddhabrot` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/dla` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/flock` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/flow` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/heightGrid` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/hydraulic` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/lenia` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/life` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/physarum` | all | verified (2026-09-26 audit sweep, worst=0) |
| `points/physical` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/loopBegin` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/loopEnd` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/meshLoader` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/meshRender` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/pointsBillboardRender` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/pointsEmit` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/pointsRender` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/render3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/renderCubemap3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/renderCubemapSurface` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/renderLandscape3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `render/renderLit3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/bitwise` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/cell` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/cellularAutomata` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/curl` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/gabor` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/gradient` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/julia` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/mandala` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/mandelbrot` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/media` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/mnca` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/modPattern` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/navierStokes` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/newton` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/noise` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/osc2d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/pattern` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/perlin` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/polygon` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/reactionDiffusion` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/remap` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/roll` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/sacredGeometry` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/scope` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/shape` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/solid` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/spectrum` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/subdivide` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth/testPattern` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/cell3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/cellularAutomata3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/flythrough3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/fractal3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/heightmap3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/noise3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/reactionDiffusion3d` | all | verified (2026-09-26 audit sweep, worst=0) |
| `synth3d/shape3d` | all | verified (2026-09-26 audit sweep, worst=0) |

## 4. Evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-threejs-remote-evidence.json).

[Bounded test evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents/threejs-tests.json). [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-threejs/actions?query=head_sha%3A815d35fb3365d66a078f0eee155b14709e9ae9f2).
[This run evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents) retains commands, exit codes, source identities, and distribution metadata.
Official ecosystem reference: [Current Three.js manual, accessed 2026-09-24](https://threejs.org/manual/en/installation.html).
Source CI, export dispatch, artifact delivery, and rendered parity are separate evidence dimensions.
A successful dispatch or unit-test summary does not establish a full rendered gate.

## 5. Open compatibility limits

Done 2026-09-26 (GAP-003 closed): the served kit `0.1.5` was run in an isolated consumer via the committed `parity/kit-consumer.mjs` — 17/17 inventory files verified against `kit.json`; engine `v1.0.185` (import-map core `31b76609…`, manifest `05c4d7b7…` unchanged, 210/210 bundles); valid program rendered with a live readback (min 86 / max 192.667 / mean 138.346) and zero console/page errors; the `.write(o9)` invalid program showed the engine's positioned `SyntaxError` diagnostic on screen; removal verified. Registry decision: the export kit is the qualified distribution; npm publication is deferred to an owner release action (the registry 404 for `noisemaker-for-threejs` is the expected state until then). Kit bytes were previously verified 2026-09-26: 17/17 files match the inventory; 13/13 source-derived files match `815d35fb` byte-for-byte; `hostlib/three` matches npm `three@0.171.0`.
The 2026-09-26 daily review re-executed every gate and both consumer drivers at `bbef9990`, all exit 0. Closures retained; no measurement changed.
See the stable entries in [completion gaps](COMPLETION_GAPS.md).

Open checks, in order:

1. GAP-005: the implementation job adds a rendered-parity CI gate. A push that changes `src/**`, `package-lock.json`, or `export-kit/**` must run the three rendered gates before the kit republishes.
2. GAP-004: re-run the three sweeps and both consumer drivers on Apple Silicon/Metal. Then run the installed consumer at three.js 0.186.1. Blocked: no macOS or Windows host exists in the audit environment.
3. Keep GAP-001 evidence current at each authority or source change.
4. npm publication remains an owner release action (registry decision in the gap register).

All eligible ports have equal priority. Full parity and zero skipped cases remain the goal.
Implementation corrections remain with the separate job. This report does not advance the parity checkpoint.

## 6. History

2026-09-25 daily review at `05f599274ed11e6d0778b7a21978f058f2b47c06`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json). No new closure claimed.

2026-09-26 completion audit at `1822646f9d6d90a164a5146f4db571eea2b98202`: full suite re-executed (programs 304/304 worst=0, stateful 13 bit-exact, corpus 81 PASS + 7 identified ERR over 88, `npm test` 66/66, lint clean). Served kit `0.1.5` byte-verified against inventory and source; npm registry 404 recorded. GAP-001's closure is re-verified by this fresh execution; GAP-002's closure is carried (src/ and package.json unchanged since 66b4291, identical served bundle; the installed-consumer harness was not re-run this pass); GAP-003 remains open. Evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`.

2026-09-26 GAP-003 closure at this report's containing commit: the served kit `0.1.5` was exercised end to end in an isolated consumer via the committed `parity/kit-consumer.mjs` (17/17 inventory sha256+bytes; engine `v1.0.185`, import-map core `31b76609…`, manifest `05c4d7b7…` unchanged, 210/210 bundles; valid program rendered with a live readback and zero console/page errors; `.write(o9)` invalid program surfaced the engine's positioned `SyntaxError` on screen; removal verified; `npm test` 66/66, lint clean at the candidate). Registry decision recorded: the export kit is the qualified distribution; npm publication is deferred to an owner release action. See STATUS.md "Kit consumer qualification 2026-09-26" and the gap register.

2026-09-26 daily review at `bbef9990b3515acf16213a6c5a088a9edd702b1c`: every gate and both consumer drivers re-executed independently, all exit 0; GAP-001, GAP-002, and GAP-003 closures verified and retained; GAP-004 (platform and host-version qualification, blocked) and GAP-005 (source-update rendered-parity CI gate, open) added. Evidence: `/series/review-20260926-133500/result.json`.

| Date | Source | Result | Change |
|---|---|---|---|
| 2026-09-26 | `bbef9990b3515acf16213a6c5a088a9edd702b1c` | Daily review: all gates and both consumer drivers re-executed (programs 304/304 worst=0, stateful 13 bit-exact, corpus 81 PASS + 7 golden-side ERR over 88, `npm test` 66/66, lint clean; installed consumer pass at three 0.160.0 and 0.171.0; kit consumer verdict pass) | Closures verified and retained; GAP-004 and GAP-005 added; npm `three` latest 0.186.1 recorded unmeasured. |
| 2026-09-26 | This report's containing commit (see `git log`) | GAP-003 closed: served kit qualified end to end (`parity/kit-consumer.mjs` gate-enforced; measured scope: Linux/headless SwiftShader, kit `0.1.5`, engine `v1.0.185`) | Kit consumer qualification added; registry decision recorded (npm publication deferred). |
| 2026-09-26 | `1822646f9d6d90a164a5146f4db571eea2b98202` | Full parity verified at the audited source (measured scope: Linux/headless SwiftShader, authority `v1.0.185`) | Audit update: fresh gate evidence, served-kit byte verification, GAP-003 next actions. |
| 2026-09-24 | `815d35fb3365d66a078f0eee155b14709e9ae9f2` | Full qualification unverified | Created the requested maintained compatibility report. Preserved historical evidence and open gaps. |

Runs: `audit-20260926-101500`, earlier `20260924-remaining-gap-documents`. Later audits and reviews update this report with source-bound results.
