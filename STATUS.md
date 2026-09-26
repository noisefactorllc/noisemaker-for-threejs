# Noisemaker for Three.js — status & parity

*Last verified 2026-07-23 on Apple Silicon / ANGLE + Metal (WebGL2) against the published engine
carrying reference `349e9909` (re-fetched via `vendor/fetch.sh`): programs sweep **303/303 PASS,
worst max-abs-diff 0**. The sources of truth are `parity/sweep-corpus.sh`,
`parity/sweep-programs.mjs`, and `parity/timeseries.mjs`.*

*Incrementally synced 2026-09-15 to reference `0ed489ec4684` (range `246ff57f43cc..0ed489ec4684`,
the same range ported into the sibling blender/cables/cpu/godot/qt ports this round; re-fetched via
`vendor/fetch.sh`, published catalog now 213 effects). Found and fixed one real adapter bug:
`ThreeBackend.compileProgram()` injected the `definesBlock` (`#define KEY value` precision +
compile-time constants) into the fragment shader only, never into a pass's custom vertex shader —
harmless until this round, since no effect had a custom-vertex pass with a per-clone `defines` value
before. `pointsRender`/`pointsBillboardRender`'s new perspective `viewMode` (2) and
`pointsBillboardRender`'s new depth-sorted alpha-blend path both clone their `deposit` pass per
`VIEW_MODE`/`BLEND_MODE`/`BLUR_LAYER`, so the gap now caused vertex shader compile failures
(`undeclared identifier 'VIEW_MODE'`) — confirmed via a before/after fixture run (FAIL,
max-abs-diff=255 → PASS, max-abs-diff=0). Fixed by injecting the same `definesBlock` into the
vertex shader whenever a pass supplies one. Added 4 new fixtures for this round's new/changed
effects (`heightmap3d_landscape`, `heightGrid_billboard`, `heightGrid_billboard_alpha`,
`heightGrid_pointsRender_perspective`) plus re-ran the existing `remap`/`remap_zoned` fixtures
(the zone-compositor was fully rewritten this round). **Full programs sweep: 307/307 PASS, worst
max-abs-diff 0** — no regressions, no new exceptions. Catalog-wide mode-coverage table below is
unchanged from the last full audit (this round added no new compile-time `MODE`/`define`-selected
variant *within* an existing effect's own `globals`, only new effects and new runtime-uniform view
modes already covered by the default-fixture-catches-uniform-bugs reasoning documented under
[Known limits](#known-limits)).

*Incrementally synced 2026-09-17 to reference `688c5146` (range `5a14256732b5..688c514655d3`) — audited upstream native WebGPU frame export row-inversion changes. ThreeBackend's frame export in `src/backend/three-frame-export.js` already applies `sourceSize.y - 1 - int(gl_FragCoord.y)` during the resolve blit, matching WebGL2 bottom-up texture coordinates to top-down canvas conventions. Verified via `npm test` (all 27 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-18 to reference `ead42a5d` (`688c514655d3..ead42a5df110a7f04d732cb200a1a39629db8a67`) — refreshed vendored CDN artifacts via `vendor/fetch.sh` (engine core + manifest + 213/213 mini-bundles). Audited upstream defaultProgram updates in `heightmap3d` and `renderLandscape3d` and transform starter position detection. Verified test suite: `npm test` (all 27 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-19 to reference `f1d2b46a` (`ead42a5df110..f1d2b46a277333413160f9f5693b93a286153612`) — re-fetched published engine artifacts via `vendor/fetch.sh` (core bundle 829964 bytes, manifest + 213/213 mini-bundles). Upstream closed compiler phase-2 harness exit-status gap (GAP-023) and updated chained variable test plan; unified agent documentation. Added unit test in `test/compile-graph.test.mjs` asserting chained variable alias plan compiles into a terminal write blit pass (`node_2_write_blit`) reading `node_1_out` and writing `global_o0`. Added `AGENTS.md` codifying repo conventions and strict symlink bans. Verified test suite: `npm test` (all 28 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-19 to reference `2df19feb` (`f1d2b46a2773..2df19feb6ce143636809b1e581699a7110b1f94d`) — ported upstream support for borrowed `VideoFrame` into `ThreeBackend.updateTextureFromSource` in `src/backend/three-backend.js`. Matches reference WebGL2 semantics: synchronous display dimension resolution, 90°/270° orientation detection, anamorphic display scaling rejection, and proper format/external texture metadata tagging. Added unit tests in `test/three-backend-videoframe.test.mjs` verifying dimensions, rotation, anamorphic rejection, zero dimensions, texture recreation on dimension changes, and GL handle deletion on cleanup. Verified test suite: `npm test` (all 29 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-20 to reference `beabda38` (`2df19feb6ce1..beabda385253a3461d2ee5ee2f1b032cbe9a2832`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 831854 bytes, manifest + 213/213 mini-bundles). Upstream introduced surface format check on global ping-pong surfaces and dynamic texture recreation when format or dimensions change (`6e0166ce`), and strict static integer 1..16 channel enforcement across all channel-based MIDI modes (`beabda38`). Added unit tests in `test/compile-graph.test.mjs` verifying legacy MIDI note modes reject non-integer / out-of-range channels and accept 1 and 16, and verifying that ThreeBackend recreates textures when format changes and reuses textures when format and dimensions match. Verified test suite: `npm test` (all 31 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-21 to reference `f61ac073` (`beabda385253..f61ac0732088`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 831943 bytes, manifest + 210/210 mini-bundles). Upstream removed expired filter effects `filter/bc`, `filter/colorspace`, and `filter/hs` (commit `2f855c9c`) following migration to `filter/adjust`. Preserved historical DSL fixtures in `parity/programs/` while filtering retired effects in active sweeps via `parity/current-programs.mjs`. Added unit test in `test/compile-graph.test.mjs` verifying `filter/adjust` compiles and expired effects are rejected by the validator. Verified test suite: `npm test` (all 35 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-21 to reference `50b8f909` (`f61ac0732088..50b8f909ff59`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 832252 bytes, manifest + 210/210 mini-bundles). Upstream closed GAP-001 by enforcing DSL output surface range `o0..o7` at the lexer level. Added unit tests in `test/compile-graph.test.mjs` verifying rejection of out-of-range output surfaces across compiler positions (`render`, `read`, `write`), preservation of `o0` and `o7` boundary behavior, and preservation of member segment accesses (`foo.o8`, `foo.o99`) and other surface families (`s99`, `vol99`, etc.). Verified test suite: `npm test` (all 38 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-22 to reference `e5bd2013` (`50b8f909ff59..e5bd2013087e`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 832319 bytes, manifest + 210/210 mini-bundles). Upstream excluded builtins from mutation introspection (`listSteps`, `replaceEffect`, `getCompatibleReplacements`) and preserved source columns in DSL diagnostics. Added unit tests in `test/compile-graph.test.mjs` verifying exclusion of builtins from mutation introspection and column preservation in compilation diagnostics. Verified test suite: `npm test` (all 40 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-22 to reference `643b2be1` (`e5bd2013087e..643b2be1e28b`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 833120 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL lexer diagnostics (`L001`..`L004`) with exact location and span coordinates attached to thrown `SyntaxError.diagnostic`. Added unit tests in `test/compile-graph.test.mjs` verifying code, location, and span properties for unexpected characters (`L001`), unterminated strings (`L002`), unclosed comments (`L003`), and out-of-range output surfaces (`L004`). Verified test suite: `npm test` (all 41 tests PASS) and `npm run lint`.*

*Incrementally synced 2026-09-22 to reference `44bc4ed4` (`643b2be1e28b..44bc4ed4ac72`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 833735 bytes, manifest + 210/210 mini-bundles). Upstream added `filtering` parameter to `renderLandscape3d` (`define: "FILTERING"`, choices: `isosurface: 0, voxel: 1`, default: 1) with isosurface raymarching path, and exposed structured DSL parser expectation diagnostics (`P001`, `P002`) with exact token coordinates or explicit null location/span on unlocated caller tokens attached to thrown `SyntaxError.diagnostic`. Added unit tests in `test/compile-graph.test.mjs` verifying `P001`/`P002` parser expectation diagnostics, explicitly unlocated caller-token coordinates, and `renderLandscape3d` compile-time filtering defines (`isosurface: 0`, `voxel: 1`). Verified test suite: `npm test` (all 44 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-23 to reference `3a32b198` (`44bc4ed4ac72..3a32b198efea`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 834404 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL parser diagnostics `P003` (automation arguments) and `P004` (search directives) with exact location coordinates or explicit null location on unlocated caller tokens. Added unit tests in `test/compile-graph.test.mjs` verifying `P003` and `P004` structured diagnostics, UTF-16 surrogate/CRLF handling, and explicit null location handling for unavailable caller coordinates. Verified test suite: `npm test` (all 49 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-23 to reference `5b81e04f` (`3a32b198efea..5b81e04f8a4b`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 836116 bytes, manifest + 210/210 mini-bundles). Upstream added conditional shader branch optimizations skipping refraction lookups in `classicNoisedeck/noise` (`fde2ea40`) and skipping glitch refraction, scanlines, and snow in `classicNoisedeck/glitch` (`9b88e567`) when amounts are zero. Ported upstream output sink deferral feature (`5b81e04f`): exposed `shouldDeferRender()` on `NoisemakerCanvas` delegating to `pipeline.shouldDeferRender()`. Added unit tests in `test/three-frame-export.test.mjs` verifying `NoisemakerCanvas.shouldDeferRender()` delegation and in `test/compile-graph.test.mjs` verifying `Pipeline.shouldDeferRender()` delegation, removal, and error isolation on throwing sinks. Verified test suite: `npm test` (all 51 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-24 to reference `c9ee8a04` (`5b81e04f8a4b..c9ee8a049b2b`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 836256 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL parser diagnostics `P005` (output validation) with exact location coordinates or explicit null location on unlocated caller tokens across invalid render targets, write calls in expression context, invalid write surfaces, invalid write3d texture targets, and invalid write3d geometry targets. Added unit tests in `test/compile-graph.test.mjs` verifying `P005` structured diagnostics, UTF-16 surrogate/CRLF handling, expectation precedence, and explicit null location handling for unavailable caller coordinates. Verified test suite: `npm test` (all 54 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-24 to reference `13fa8b54` (`c9ee8a049b2b..13fa8b5400257e8fa134d19d65aa21516e81f7cf`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 836408 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL parser diagnostics `P006` (subchain validation) with exact location coordinates or explicit null location on unlocated caller tokens across non-string subchain arguments, argument at EOF, missing body dot, body at EOF, empty subchain body, comment-only subchain body, CRLF/tab/UTF-16 arguments, and missing dot after comment. Added unit tests in `test/compile-graph.test.mjs` verifying `P006` structured diagnostics, UTF-16 surrogate/CRLF handling, expectation precedence, explicit null location handling for unavailable caller coordinates, and valid subchain compilation/op expansion. Verified test suite: `npm test` (all 58 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-24 to reference `fca611fd` (`13fa8b540025..fca611fd8f91`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 838436 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL parser diagnostics `P007` (call form validation) with exact location and source-derived span coordinates or explicit null location/span on unlocated caller tokens across `from` named/missing arguments, non-identifier namespaces, non-call second arguments, inline namespace syntax, and mixed positional/keyword arguments (`4891b995`), derived parser diagnostic coordinates directly from source positions (`9fa1a221`), and preserved source provenance on array literals to derive numeric-coercion diagnostic coordinates (`fca611fd`). Added unit tests in `test/compile-graph.test.mjs` verifying `P007` structured diagnostics, UTF-16 surrogate/CRLF handling, explicit null location/span handling for unavailable caller coordinates, source-derived spans on expectation diagnostics (`P001`..`P006`), numeric coercion diagnostics with array positions and unlocated operands, AST shape invariance with private `position` on `ArrayLiteral`, and valid call forms with `fromOverride`. Verified test suite: `npm test` (all 65 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-25 to reference `240740dd` (`fca611fd8f91..240740dd2d30`, covering Tearoff #513 trigger `4891b995..240740dd`) — refreshed published engine artifacts via `vendor/fetch.sh` (core bundle 841350 bytes, manifest + 210/210 mini-bundles). Upstream exposed structured DSL parser diagnostics for subchain arguments under GAP-027 (`66b2c721`): `P008` (unknown/discarded subchain argument key warning), `P009` (duplicate subchain argument key warning, last value wins), `P010` (missing comma separator between keyword arguments warning), and opt-in strict validation (`subchainArguments: 'strict'`), along with differential coverage baseline (`240740dd`). Added unit tests in `test/compile-graph.test.mjs` verifying `P008`, `P009`, `P010` warning diagnostics with source coordinates, AST projection invariance discarding unknown keys, duplicate argument precedence, missing separator diagnostics, strict-mode opt-in rejections, and updated legacy permissive subchain argument assertions. Verified test suite: `npm test` (all 66 tests PASS), `npm run lint`, and `npm run parity` (PASS=81 FAIL=0 ERR=7 worst=0).*

*Incrementally synced 2026-09-25 to upstream reference `9d3474df` (audit window
`240740dd2d30..9d3474dfdc6c` in noisefactorllc/noisemaker, covering Tearoff trigger
`4891b995..9d3474dfdc6c` with force-push ambiguity — resolved by diffing a fresh local clone of
the upstream repo rather than the trigger's range summary; no sibling dependency is added to the
repo). Evidence provenance, split by what is reproducible here versus observed upstream:

  In-repo, re-checkable without network (the adapter executes ONLY the published CDN artifact):
  - `vendor/noisemaker/noisemaker-shaders-core.esm.js`: 841350 bytes, SHA-256
    `7b4515a27ec41b81f812c8b10ffb64a23eb18c62288eb85f9d9c5518a5a4ba48` — byte-identical to the
    bundle pinned by the previous sync entry (`240740dd`), i.e. the CDN `/1` publication did not
    change across this upstream increment.
  - `vendor/noisemaker/effects/manifest.json`: SHA-256
    `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`; 210 mini-bundles on disk.
  - The core bundle contains zero occurrences of `validateEffectDefinition`/`effect-validator`.

  Upstream-audit facts (from the local clone; per-commit file lists):
  - `shaders/` changed in exactly two commits, both restricted to
    `shaders/src/runtime/effect-validator.js` + `shaders/tests/test_effect_definition_validation.js`
    (`ba87ffae` runtime effect-definition validation, upstream repo's own GAP-003; `9d3474df`
    contract completion + test wiring into upstream's `scripts/run-js-tests.js` /
    `test:shaders:runtime`). Zero effect-definition (`shaders/effects/`) diffs in the window.
  - All other commits in the window touch only `llms-full.txt`, `LEDGER.md`, docs/plans, and the
    landing page — nothing in `shaders/`.

Because the validator is upstream-side test tooling that is not exported by the published bundle
(checkable above), it touches nothing in this adapter's execution path. Cross-check run in the
authoring environment: the new upstream validator applied to the vendored catalog reported 209/210
mini-bundles clean; the sole flag is `filter/text`, whose vendored class does not subclass the
upstream `Effect` (the bundle ships its own base class, so the validator treats the instance as a
plain object and diagnoses its legitimate runtime `id` field), and the CDN packaging step adds a
`help` field upstream's source definitions don't carry (upstream's own corpus gate on
`shaders/effects/**/definition.js`: expected=210 executed=210 pass=210 failure=0). Both are
packaging artifacts, not definition or adapter defects. No adapter code changes required.

Checks run in the authoring environment at the pre-commit working tree (not CI at this SHA): `npm
test` (all 66 tests PASS), `npm run lint` (clean), and `npm run parity` headless (SwiftShader) as
an environmental smoke check — every completed program matched byte-exactly (worst=0) with only
the documented golden-side compilation ERRs; the full PASS=81 FAIL=0 ERR=7 ledger remains pinned
to the last Apple Silicon run above.*

*Full qualification 2026-09-26 at upstream reference `8eeb7b5a` (published authority tag
`v1.0.183`), closing the prior smoke-check-only state. The CDN `/1` republished since the
`9d3474df` audit (verified by re-running `bash vendor/fetch.sh` on 2026-09-26: previous bundle
841350 bytes / SHA-256 `7b4515a2…`, current bundle 858616 bytes / SHA-256
`092c3b776003bc1539bed91aa86f421f839b40b1aa8b81ea09a5ec5e6b7bd3c7`; `effects/manifest.json`
unchanged at SHA-256 `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`,
210/210 mini-bundles). Authority identification: CDN bundle Last-Modified
2026-09-25T22:45:29Z falls within 18 minutes of the `v1.0.183` tag timestamp
(2026-09-25T22:27:36Z, commit `8eeb7b5a`); the shader deltas in the window are `62eb56fa`
(WebGL2 mip-chain allocation + WebGPU mip bind-group caching), `2f47612c` (stop double-creating
global surfaces on allocation change), and `fa83eeab` (copy name/viewport/clear/samplerTypes/type
onto expanded passes, GAP-005) — all engine-side surface-allocation/pass-metadata work feeding the
published bundle the adapter executes verbatim. Raw sweep output was regenerated against this
exact bundle in this Linux/headless-SwiftShader environment (Chrome Headless Shell 149.0.7827.55,
playwright chromium-headless-shell v1228, `PLAYWRIGHT_BROWSERS_PATH=/state/cache/pw-browsers`),
exact frame comparisons at the default tolerance (`max-abs-diff ≤ 2.001`, SSIM ≥ 0.98 in the
harness, every PASS reported worst=0):

- `node parity/sweep-programs.mjs` (frames=1 capture=1 size=128, loopFrames=600): **PASS=304
  FAIL=0 ERR=0, worst max-abs-diff=0** — full current-program roster incl. every compile-time
  mode variant; no exceptions.
- `bash parity/sweep-stateful.sh` (frames=30 capture=15 size=128, 13 stateful fixtures):
  **worst max-abs-diff=0** — all bit-exact at every captured frame.
- `npm run parity` corpus sweep (frames=20 capture=10 size=128, all 88 fetched gallery
  programs — denominator unchanged): **PASS=81 FAIL=0 ERR=7 worst=0**. The 7 ERR rows are the
  documented golden-side `ERR_COMPILATION_FAILED` (S001) cases — 5 × `chromeicosahedroninterior`
  (`4bm9AA`, `B5oBsA`, `PmJyUQ`, `fKPUww`, `liTYEg`) and 2 × `vaporwaveflyover` (`8KMvAg`,
  `WyalUg`) — community effects not published to the CDN catalog; both backends reject them
  identically before rendering (no candidate-side error, no exclusion from the denominator:
  81+7=88 reported).
- Compiler gate `npm test`: **66/66 tests PASS, exit 0** (one full-suite process; the browser
  frame-export test requires `PLAYWRIGHT_BROWSERS_PATH` to locate the downloaded headless shell
  in this container). `npm run lint`: clean, exit 0.

This run was authored in the Linux/headless-SwiftShader container, not on Apple Silicon/Metal;
platform scope is unchanged from the [Known limits](#known-limits) note. Raw per-sweep output
and the mode ledger were regenerated in `parity/out/` (gitignored scratch) at the pre-commit
working tree; the commit containing this entry is the evidence-binding revision.*

*Installed consumer qualification 2026-09-26, closing the installed-workflow state (GAP-002).
Artifact: `npm pack` of this tree — `noisemaker-for-threejs-0.0.1.tgz`, 465 files, 408097 bytes,
SHA-256 `de3fc2ff427e08c170740ab9174149f1db60f816ed3ced65db3044943dd4a937` (npm shasum
`524be92505ff16d1d8f7720d9361084ee24c0ceb`). Engine input: the current served CDN `/1` bundle —
870700 bytes, SHA-256 `8b9f9eee0cffdb88e96907d32eb8d73128cca6ccdbaefb47b5eb026b894a8469`
(Last-Modified 2026-09-26T01:49:01Z; the CDN republished again after the GAP-001 closure's
`092c3b77…`/858616-byte bundle; `effects/manifest.json` unchanged at SHA-256
`05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`, 210/210 mini-bundles) —
fetched inside each installed consumer via `npm run vendor` and verified byte-identical in both
trees. Consumers: two isolated directories, `npm i <tarball> three@0.160.0` (declared peer
floor) and `three@0.171.0` (current supported). Harness: `parity/installed-consumer.mjs`
drives an import-mapped page that imports the adapter from the INSTALLED package
(`/node_modules/noisemaker-for-threejs/src/index.js`) over loopback HTTP. Host: Linux
6.8.0-134-generic, Node v26.5.1, Chrome Headless Shell 149.0.7827.55 (playwright
chromium-headless-shell v1228, `PLAYWRIGHT_BROWSERS_PATH=/state/cache/pw-browsers`), GPU
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`,
WebGL2 true. Every step completed with zero console errors and zero page errors in both
versions; the measured numbers below are IDENTICAL for three 0.160.0 and 0.171.0:

- **NoisemakerTexture on a lit mesh** — compile
  `search synth, filter\nnoise(seed: 3, scaleX: 20, scaleY: 20).bloom().write(o0)\nrender(o0)`,
  `update(0.25)`, two `renderer.render(scene, camera)` passes. Texture readback (128²,
  65536 samples): min 0.000018, max 1.431641, mean 0.605436 — a live non-constant image;
  default-framebuffer GPU readback mean 38.021/255 (`preserveDrawingBuffer` on). Screenshot
  SHA-256 `db9bff66f93d32608f0796b7898dcd973e44863b31116d54b4805be3d12ae6d1` — byte-identical
  across both three versions.
- **NoisemakerPass in EffectComposer** — `RenderPass(scene, camera)` + generative
  `noise(seed: 5).bloom().write(o0)` pass; `composer.render()` completed. Screenshot SHA-256
  `612aac31efa68df6ec8cfe8af2ac149e12804c01517aa018c06d9ec6f9a418ed` — byte-identical across
  both three versions.
- **Resize** — `renderer.setSize(480, 320)` + `composer.setSize(480, 320)` + camera aspect
  update; canvas measures 480×320 and re-renders without error. Observed limit: post-resize
  and post-recovery composer frames vary at sub-LSB level between runs under SwiftShader
  (consecutive-render framebuffer means 158.231 vs 158.172 at 0.160.0; 158.228 vs 158.142 at
  0.171.0; the resize/recovery screenshots are not byte-stable across runs). Resize is verified
  functionally; byte-stability at resized targets is NOT claimed (the fixed-size paths above
  are byte-stable and cross-version identical).
- **Invalid DSL through the installed entry point** — `nmTex.compile()` of
  `noise(scaleX: 10).write(o9)` threw `SyntaxError`: "Output surface reference 'o9' is out of
  range; expected o0-o7 at line 2 col 25", structured diagnostic `L004`, line 2 column 25,
  span [45, 47).
- **Recovery** — a fresh valid compile
  (`noise(seed: 7, scaleX: 30, scaleY: 30).adjust(rotation: 90)`) after the failure, `update(0.5)`,
  and `composer.render()` all succeeded; texture readback min 0.000006, max 1, mean 0.573125.
- **Dispose** — `nmTex.dispose()` + `nmPass.dispose()` dropped three's own counters from
  textures 153 / geometries 3 / programs 8 to 2 / 1 / 1; `composer.render()` after adapter
  disposal raised no exception; `renderer.dispose()` + `forceContextLoss()` completed. Post-dispose
  screenshot SHA-256 `2b6f5dadafc15613197994b2dc486e938b1e443d7520f1adcec05dd93a90f503`
  (blank context), byte-identical across both three versions.

Cancellation and file preservation are not applicable to this workflow (the installed adapter
performs no file I/O; there is no long-running job to cancel) — recorded explicitly, not
skipped silently. Platform scope: this qualification ran on Linux/headless SwiftShader only;
Apple Silicon/Metal remains unqualified (unchanged STATUS Known limits). The npm
publication/upgrade/removal and served-kit leg remains GAP-003. Every recorded run is
gate-enforced: `parity/installed-consumer.mjs` exits 0 only when every step completed (no
stepError), the driver raised no error, the page logged zero console errors, and dispose left
the renderer renderable (`postDisposeRenderThrows === false`); the recorded values above come
from gate-passing runs (`gate: []`, exit 0 in both versions). Raw per-run output
(`results.json` per version, with the full step record and the enforced-gate verdict) and
screenshots were regenerated in gitignored scratch at the pre-commit working tree with the
committed `parity/installed-consumer.mjs`; the hashes above bind this entry to that run.*

> **The programs sweep runs at frame 1, where normalized time is 0** (`t_i = i / loopFrames`).
> That makes it a compile/link/uniform-binding gate, not a temporal one: any effect whose output
> is scaled by `time` renders its static form there. `filter/pondRipples`' `speed` control is the
> current example — its two fixtures guard that the new uniform binds and stays byte-exact, but
> the animated path has to be verified with a non-zero time, e.g.
> `node parity/timeseries.mjs parity/programs/pondRipples_speed.dsl --frames 150 --capture 150`
> (t = 0.25), where golden and candidate stay byte-identical *and* differ from the `speed=0`
> render. Don't read a frame-1 PASS as proof that a time-dependent parameter works.

This file holds the detailed coverage and parity numbers. For what the project is and how to use it,
see the [README](README.md).

## Coverage

**210 effects** across 8 namespaces (was 213; removed expired `filter/bc`, `filter/colorspace`, `filter/hs` — 2026-09-21 sync) — the published catalog
(`vendor/noisemaker/effects/manifest.json`), content-pinned to the `/1` CDN build re-fetched
2026-09-21. Earlier snapshot below content-pinned to the `1a29d431` build (2026-07-14T19:47:07.486Z).
25 new `filter`
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
| `filter` | 113 | byte-identical (112; `text` untested) |
| `mixer` | 15 | byte-identical |
| `classicNoisedeck` | 20 | byte-identical (meta/param effects: `composite`, `kaleido`, `refract`, …) |
| `points` / `render` | 11 / 12 | byte-identical (agents via time-series; `meshLoader` / `meshRender` via injected OBJ) |
| `synth3d` / `filter3d` | 8 / 2 | byte-identical (2D-atlas volumes raymarched in-shader; cubemaps via `cubeBasis`) |

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
