# noisemaker-for-threejs: completion gaps

Current compatibility matrix: [compatibility report](COMPATIBILITY.md).

## 1. Scope and source revisions

Completion audit: 2026-09-26. Audited source: [`1822646f9d6d90a164a5146f4db571eea2b98202`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/1822646f9d6d90a164a5146f4db571eea2b98202).
Local HEAD matched remote main before and after checks. Full rendered parity executed at this source.
Result: programs 304/304 worst=0, stateful 13 bit-exact, corpus 81 PASS plus 7 identified ERR over 88, compiler 66/66.
GAP-001, GAP-002, and GAP-003 closures stand at this register (GAP-003 closed 2026-09-26 with the kit-consumer qualification).
Served authority: CDN `/1` bundle SHA-256 `8b9f9eee…` (870700 bytes), manifest SHA-256 `05c4d7b7…`, 210/210 mini-bundles.
Identified as published authority `v1.0.185`, source `6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa`. Upstream head `a651c075` is docs-only after that tag.
Served kit `0.1.5` at `815d35fb3365d66a078f0eee155b14709e9ae9f2`: all 17 served files match the inventory hashes.
All 13 source-derived kit files are byte-identical to that SHA. Kit-relevant source is unchanged through `1822646`.
The npm registry has no `noisemaker-for-threejs` package (HTTP 404). Evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`.

Daily review: 2026-09-26. Reviewed source: [`bbef9990b3515acf16213a6c5a088a9edd702b1c`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/bbef9990b3515acf16213a6c5a088a9edd702b1c).
The review re-executed every gate and both consumer drivers. All commands exited 0. It adds GAP-004 and GAP-005. No closure changed.
Evidence: `/series/review-20260926-133500/result.json`.

### Earlier source observations

Daily review: 2026-09-25. Current inspected source: [`05f599274ed11e6d0778b7a21978f058f2b47c06`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/05f599274ed11e6d0778b7a21978f058f2b47c06).
Full rendered parity remained unverified at that review. Current upstream discovery: `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.
Current served kit: `0.1.5`, source `815d35fb3365d66a078f0eee155b14709e9ae9f2`. Artifact identity did not establish host qualification.

Date: 2026-09-24. Reviewed SHA: [`815d35fb3365d66a078f0eee155b14709e9ae9f2`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/815d35fb3365d66a078f0eee155b14709e9ae9f2).
Local HEAD matched remote main before checks. The operator requested registers for all remaining eligible ports in this run.
This initial register contains bounded evidence. It is not a completed port audit or release approval.
No implementation or parity checkpoint changed. Full audits remain in the rotation.

Three.js WebGL2 adapter with texture, canvas, and EffectComposer entry points. The declared peer range begins at Three.js 0.160. [Contract](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md).

The vendor fetch uses the published CDN engine. STATUS records successive revisions, but fetched files remain outside the repository.
Current upstream at discovery: `c9ee8a049b2b63cd300da67c01ee40baf29dc288`.
Current CPU authority: `f2eb495d70abcb74e3632e7a652a4f83e4f3b11e`.
These authority heads are review targets, not qualification results. No goldens were regenerated.

Served kit `0.1.5` identifies `815d35fb3365d66a078f0eee155b14709e9ae9f2`. [Metadata](https://kits.noisedeck.app/threejs/0/deployment-meta.json). Inventory and compatibility metadata were retrieved. Complete artifact bytes were not checked.

These document paths do not match the current publication workflow filters.
The containing commit identifies this register's publication revision. The shared run record retains commits, remote hashes, and downstream results.

## 2. Completion claims

| Claim ID | Claim source | Claimed scope | Finding | Evidence |
|---|---|---|---|---|
| CLAIM-001 | [STATUS](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/1822646f9d6d90a164a5146f4db571eea2b98202/STATUS.md) | Catalog and mode fixtures are pixel-identical. Live inputs and broader hosts need separate qualification. | supported | 2026-09-26 audit: programs 304/304 worst=0, stateful 13 bit-exact, corpus 81+7 identified ERR over 88, Linux/headless SwiftShader. Live inputs stay injected-only. |
| CLAIM-002 | [README](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/1822646f9d6d90a164a5146f4db571eea2b98202/README.md) | Human usability: installation, output, errors, and recovery | supported | GAP-002 closed 2026-09-26. Installed consumers at three 0.160.0 and 0.171.0; resize, L004 diagnostic, recovery, dispose. Linux/headless SwiftShader only. |
| CLAIM-003 | [Ecosystem reference](https://threejs.org/manual/en/installation.html) | Ecosystem fit and version support | partial | Installed integration verified at the floor and current three versions on Linux only. Other versions and platforms remain unmeasured. npm `three` latest `0.186.1` is unmeasured (GAP-004). |
| CLAIM-004 | [README](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/1822646f9d6d90a164a5146f4db571eea2b98202/README.md) | Release readiness | supported with limits | GAP-003 closed 2026-09-26: served kit exercised end to end (render, invalid-input diagnosis, removal), hashes/notices/lifecycle recorded, registry decision defined (npm publication deferred to an owner release action; 404 is the expected state until then). Open limits: GAP-004 (platform and host-version qualification, blocked) and GAP-005 (no source-update rendered-parity CI gate; release blocker). |
| CLAIM-005 | [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-threejs/actions?query=head_sha%3A1822646f9d6d90a164a5146f4db571eea2b98202) | Workflow status only | supported | No check runs exist at `1822646` (docs-only path filters). Latest export kit run 35954455774 passed at `815d35fb`. A green dispatch does not qualify rendered parity. |

## 3. Methods and evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-threejs-remote-evidence.json).

### Completion audit, 2026-09-26

Source `1822646`, local and remote identical. Environment: Linux 6.8.0-134-generic, Node v26.5.1, Chrome Headless Shell 149.0.7827.55, SwiftShader. All commands exited 0.

| Command | Exit | Result |
|---|---|---|
| `bash vendor/fetch.sh` | 0 | core 870700 bytes SHA-256 `8b9f9eee…`; manifest SHA-256 `05c4d7b7…`; 210/210 mini-bundles |
| `node parity/sweep-programs.mjs` | 0 | PASS=304 FAIL=0 ERR=0 worst max-abs-diff=0 |
| `bash parity/sweep-stateful.sh` | 0 | 13 fixtures bit-exact, worst=0 |
| `npm run parity` | 0 | PASS=81 FAIL=0 ERR=7 worst=0 over 88 programs; 7 ERR rows identified as golden-side S001 |
| `node --test test/*.test.mjs` | 0 | 66 tests, 66 pass, 0 fail, 0 skipped |
| `npm run lint` | 0 | clean |

Sweep denominators: 307 fixtures minus 3 retired historical effects (`bc`, `hs`, `colorspace`) absent from the current manifest. The `text` fixture executed and passed.
The 7 corpus ERR rows are `4bm9AA`, `8KMvAg`, `B5oBsA`, `PmJyUQ`, `WyalUg`, `fKPUww`, `liTYEg`. Both backends reject them identically before rendering.
Raw evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`.

Distribution checks this pass: all 17 served kit files match `kit.json` hashes and bytes.
13/13 source-derived kit files match `git show 815d35fb:<path>` byte-for-byte. `hostlib/three` matches npm `three@0.171.0` bytes.
`compat.json` is `{"mode":"all"}`. The registry has no `noisemaker-for-threejs` package (HTTP 404).

### Daily review, 2026-09-26

Source `bbef9990`, local and remote identical, clean checkout. Environment: Linux 6.8.0-134-generic, Node v26.5.1, Chrome Headless Shell 149.0.7827.55, SwiftShader. The review re-executed every gate and both consumer drivers. All commands exited 0.

| Command | Exit | Result |
|---|---|---|
| `bash vendor/fetch.sh` | 0 | core 870700 bytes SHA-256 `8b9f9eee…`; manifest SHA-256 `05c4d7b7…`; 210/210 mini-bundles |
| `node parity/sweep-programs.mjs` | 0 | PASS=304 FAIL=0 ERR=0 worst max-abs-diff=0; mode ledger 304/304 PASS |
| `bash parity/sweep-stateful.sh` | 0 | 13 fixtures bit-exact, worst=0 |
| `npm run parity` | 0 | PASS=81 FAIL=0 ERR=7 worst=0 over 88 programs; 7 ERR rows are golden-side S001 |
| `node --test test/*.test.mjs` | 0 | 66 tests, 66 pass, 0 fail, 0 skipped |
| `npm run lint` | 0 | clean |
| `node parity/installed-consumer.mjs` at three 0.160.0 and 0.171.0 | 0 | both runs `ok` with empty gate; vendor hashes `8b9f9eee…`/`05c4d7b7…` enforced against the installed bytes |
| `node parity/kit-consumer.mjs` | 0 | verdict `pass`; 17/17 inventory sha256+bytes; 210/210 bundles; valid leg non-constant with zero console/page errors; invalid leg showed the positioned `SyntaxError` on screen; removal verified |

Remote checks: served kit `0.1.5` metadata at `815d35fb`; npm registry HTTP 404; upstream head `a651c075` docs-only after `v1.0.185`; zero check-runs at `1822646`, `66e05c5`, `bbef999`; latest export-kit run 35954455774 passed at `815d35fb`.
`git diff 66b4291..bbef999 -- src package.json` is empty, so the GAP-002 carry is byte-backed.
Manifest audit: 210 entries; `chromeicosahedroninterior`, `vaporwaveflyover`, `bc`, `hs`, `colorspace` are absent, which supports the 304 and 88 denominators.
npm `three` latest is `0.186.1`; versions above the verified `0.171.0` remain unmeasured (GAP-004).
Raw evidence: `/series/review-20260926-133500/result.json`.

### Daily review, 2026-09-25 (superseded by the 2026-09-26 qualification and audit)

65 unit tests pass and the packed artifact contains 465 files. Neither result establishes complete browser rendering or a consumer install across the declared Three.js peer range. The prior compatibility measurements remain historical. GAP-001 remains open. Current full parity is stale and unverified. [Raw evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json).
The review checked source changes, worker evidence, source-bound CI where present, and current served inventories. Full installed-host and platform qualification remains incomplete.

Environment: macOS 26.5, Darwin arm64.
[Source SHA-256 records](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents/noisemaker-for-threejs-source-hashes.json) bind these checks to the reviewed revision.
[Raw command evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents/threejs-tests.json). [Remote evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents/noisemaker-for-threejs-remote.json).

Executed command:

```sh
node --test test/*.test.mjs
```

51 Node tests passed. The full browser image sweep and installed consumer workflow were not executed. Final exit code: 0.
No image denominator or tolerance follows from a unit-test or generated-file result.
Official reference: [Current Three.js manual, accessed 2026-09-24](https://threejs.org/manual/en/installation.html).

| Outcome | Observed scope | Remaining work |
|---|---|---|
| Installation | Instructions and metadata inspected | Install the actual artifact privately. |
| First useful output | Selected checks only | Install into an isolated consumer, render a texture on a mesh, run an EffectComposer pass, resize, recover from invalid DSL, and dispose. |
| Host integration | Not fully exercised | Check parameters, external inputs, state, resize, and cleanup. |
| Errors and recovery | Only the selected checks above | Fail through the installed entry point, correct input, and render again. |
| Distribution | Metadata inspection | Pack and install the adapter into an isolated consumer. Check engine discovery, public module imports, examples, licenses, and removal. |
| Accessibility | Not observed | Check keyboard, focus, labels, and diagnostics for provided interfaces. |

Headless libraries do not require an editor accessibility test. Their CLI diagnostics and failure handling still require checks.
Host presence does not prove host qualification. This pass made no global installation or user-project changes.

## 4. Known gaps

P1 means false completion or major correctness failure. P2 means coverage or integration uncertainty. P3 means documentation inconsistency.
These entries record missing qualification. They do not infer implementation defects from absent tests.

### GAP-001: current authority and parity qualification

- Status: closed 2026-09-26. Priority: P2. Category: verification.
- Affected scope: src/, vendor/fetch.sh, package.json, examples/, parity/, STATUS.md
- Expected behavior: Reproducible evidence binds each supported claim to the port and authority revisions.
- Observed behavior: A wide Three.js peer range and rolling vendor inputs need current qualification. Historical exact pixels do not qualify untested versions or external feeds.
- Evidence: STATUS.md, "Full qualification 2026-09-26" entry (raw sweep output and hashes), and section 3.
- Resolution: Immutable authority inputs resolved — current CDN `/1` bundle 858616 bytes, SHA-256 `092c3b776003bc1539bed91aa86f421f839b40b1aa8b81ea09a5ec5e6b7bd3c7` (re-fetched 2026-09-26, byte-identical on re-fetch), manifest SHA-256 `05c4d7b7744837ae90a3bb4c89e5403ff09448a74d9d7e824abb3d719ad3314e`, 210/210 mini-bundles; identified as published authority `v1.0.183` = upstream `8eeb7b5a` (CDN Last-Modified 2026-09-25T22:45:29Z vs tag 2026-09-25T22:27:36Z). Full programs sweep 304/304 PASS (worst max-abs-diff=0), stateful sweep 13 fixtures bit-exact (worst=0), corpus sweep 81 PASS + 7 ERR over all 88 fetched programs with every ERR row identified (5 × `chromeicosahedroninterior`, 2 × `vaporwaveflyover` — golden-side S001, unpublished community effects; denominator 81+7=88 unchanged), compiler gate `npm test` 66/66 PASS exit 0, `npm run lint` clean.
- Dependencies: Resolved — immutable authority inputs pinned by hash; historical goldens and provenance preserved (previous `7b4515a2…`/841350-byte bundle recorded).
- Acceptance criteria: Met. Every case, parameter variant, exclusion, error, and tolerance is reported in the STATUS entry (default harness tolerance `max-abs-diff ≤ 2.001`, every PASS worst=0); the corpus denominator was not reduced (88/88 reported, 7 ERR rows named).
- Required checks: Existing compiler and rendered parity gates, with raw output and exact source hashes — run at the pre-commit working tree of the commit containing this closure (Linux/headless SwiftShader, Chrome Headless Shell 149.0.7827.55); raw output regenerated in `parity/out/` (gitignored) and summarized verbatim in STATUS.md.
- Remaining limits (non-blocking): `filter/text` passes in-suite (same-browser font raster, worst=0); cross-machine font-raster stability remains unclaimed (STATUS Known limits). This qualification ran on Linux/SwiftShader, not Apple Silicon/Metal. Live (non-injected) external inputs remain out of scope.
- Last verification: 2026-09-26. Full behavior qualification for the current authority is evidenced at the commit carrying this record.

### GAP-002: installed developer workflow qualification

- Status: closed 2026-09-26. Priority: P2. Category: usability.
- Affected scope: Public API, examples, supported hosts, errors, recovery, and lifecycle.
- Expected behavior: Developers can install, produce useful output, integrate it, recover from errors, and remove the package.
- Observed behavior: This pass did not exercise the complete installed workflow or supported-version matrix.
- Evidence: STATUS.md, "Installed consumer qualification 2026-09-26" entry (packed-tarball hash, engine-bundle hash, per-step output, diagnostics, recovery results, dispose counters, screenshot hashes), and section 3.
- Resolution: The packed artifact (`noisemaker-for-threejs-0.0.1.tgz`, 465 files, SHA-256 `de3fc2ff427e08c170740ab9174149f1db60f816ed3ced65db3044943dd4a937`) was installed into two isolated npm consumers — three.js `0.160.0` (declared peer floor) and `0.171.0` (current supported) — with the served engine (`8b9f9eee…`/870700 bytes, manifest `05c4d7b7…` unchanged, 210/210 mini-bundles) fetched inside each installed package via `npm run vendor`, with the installed vendored bytes hashed by the committed driver and gate-enforced against the expected bundle/manifest hashes (mechanism-backed byte identity across both trees; see Dependencies). `parity/installed-consumer.mjs` then exercised, through the installed package's public entry points on headless SwiftShader (Chrome Headless Shell 149.0.7827.55): `NoisemakerTexture` compiled onto a lit box mesh with a live non-constant image (readback min 0.000018 / max 1.431641 / mean 0.605436; GPU framebuffer mean 38.021/255), a `NoisemakerPass` inside `EffectComposer` rendered, resize to 480×320 re-rendered without error, an invalid DSL program threw `SyntaxError` with structured diagnostic `L004` (line 2 col 25, span [45, 47), "Output surface reference 'o9' is out of range; expected o0-o7"), a fresh valid compile + `update(0.5)` + `composer.render()` recovered (readback min 0.000006 / max 1 / mean 0.573125), and dispose dropped three's own counters from textures 153 / geometries 3 / programs 8 to 2 / 1 / 1 with no post-dispose exception. Zero console and zero page errors in both runs. Mesh-render, composer-pass, and post-dispose screenshots are byte-identical across both three versions (SHA-256 `db9bff66…`, `612aac31…`, `2b6f5dad…`); measured numbers are identical across versions.
- Dependencies: Resolved — isolated consumers (separate scratch directories, npm tarball install only; the committed driver serves its qualification page from memory and never writes into the consumer tree); host, GPU, licensing (MIT, LICENSE shipped in the tarball), and input (DSL text programs) identified and recorded before execution. The installed package's vendored engine bytes are hashed by the committed driver and the gate enforces them against expected hashes (`8b9f9eee…` bundle, `05c4d7b7…` manifest), and mini-bundle completeness is measured (210 bundle files === 210 manifest entries, gate-enforced), so the byte-identity and inventory claims are mechanism-backed, not self-reported.
- Acceptance criteria: Met. Artifact hash, steps, meaningful output, error diagnostics, recovery results, and cleanup results are retained verbatim in the STATUS entry and enforced by the driver's exit gate (step completion, driver/console errors, dispose rendering and resource release, exact L004 contract, non-constant readbacks, non-blank mesh readback, and expected vendor-hash match — a wrong expected hash fails with exit 1); screenshot and results JSONs were regenerated in gitignored scratch with the committed harness at the pre-commit working tree of the commit carrying this record.
- Required checks: Minimum (0.160.0) and current (0.171.0) supported three.js versions both tested in installed consumers. Cancellation and file preservation are not applicable to this workflow (no file I/O, no long-running job) — recorded explicitly. Unavailable platforms kept explicit: Linux/headless SwiftShader only; Apple Silicon/Metal untested; byte-stability at resized targets not claimed (sub-LSB run-to-run variance under SwiftShader, ≤1 LSB, recorded in STATUS).
- Remaining limits (unchanged, non-blocking): npm publication, upgrade/removal, and served-kit qualification remain GAP-003 — that gap covers the "remove the package" leg of the expected behavior for the actual distribution (this qualification exercised the in-page dispose and context-loss cleanup only); Apple Silicon/Metal remains a separate qualification.
- Last verification: 2026-09-26. Installed-workflow qualification for the current served engine is evidenced at the commit carrying this record.

### GAP-003: distribution and release qualification

- Status: closed 2026-09-26. Priority: P2. Category: release.
- Affected scope: Actual artifact, dependencies, notices, version promises, and release evidence.
- Expected behavior: The delivered artifact supports its documented installation and first useful result.
- Observed behavior: Kit bytes verified. The kit host workflow, notices, removal, and upgrade path are now exercised and recorded; the registry decision is defined.
- Evidence: STATUS.md, "Kit consumer qualification 2026-09-26" entry (served-kit inventory and engine hashes, per-leg output, diagnostics, screenshot hashes, removal), section 3, and the committed `parity/kit-consumer.mjs` driver.
- Byte verification 2026-09-26: served kit `0.1.5` at `815d35fb`. All 17 files match `kit.json` hashes and sizes. 13/13 source-derived files match that SHA byte-for-byte. `hostlib/three` matches npm `three@0.171.0`. Kit-relevant source is unchanged through `1822646`.
- Resolution: The served kit was assembled into an isolated consumer from the production distribution (never from this checkout) by the gate-enforced committed driver `parity/kit-consumer.mjs` (`results.json` verdict `pass`, exit 0). 17/17 inventory files verified against `kit.json` sha256+bytes; engine pinned to published authority `v1.0.185` = `6a0af04d` (import-map core ESM `31b76609…`/412659 bytes; manifest `05c4d7b7…` unchanged; 210/210 mini-bundles, count gate-enforced). The kit's own `index.template.html` was injected with the exporter's placeholders using the committed `parity/programs/adjust.dsl`. Valid leg: page reached `running`, canvas readback min 86 / max 192.667 / mean 138.346 (live non-constant image), zero console and zero page errors; screenshot `053d70a6…`. Invalid leg (`.write(o9)`): on-screen "This program could not start" with the engine's positioned `SyntaxError: Output surface reference 'o9' is out of range; expected o0-o7 at line 2 col 55` from `NoisemakerCanvas.compile`; the console error is the page's designed "Noisedeck export failed" channel; screenshot `bcb57da7…`. Observed difference (not a defect): the served kit surfaces the engine's positioned `SyntaxError` without the structured `L004` code — `L004` is the installed npm package's validator surface and remains enforced by the GAP-002 gate (carried: src/ and package.json unchanged since its closing commit, identical served manifest). Removal: the consumer folder was deleted and the driver verified the page file no longer readable. Notices: `LICENSES/noisemaker-MIT.txt` (`91c83bf2…`/1078 bytes) and `LICENSES/noisemaker-for-threejs-LICENSE.txt` (`e502d1ba…`/1073 bytes) are hash-verified members of the served tree. Upgrade path: the kit pins the engine by design; upgrade is a re-export from the app against a newer pinned engine, not an in-place update — recorded, not exercised (no newer engine is published).
- Registry decision: The qualified distribution is the export kit. `noisemaker-for-threejs` is NOT published to npm as part of this qualification. npm publication is an owner release action requiring registry credentials; when the owner opts in, publish via `npm pack` from a tagged release of this repo (the same artifact GAP-002 installed and qualified at the peer floor and current three). Until that release, the registry 404 (`noisemaker-for-threejs`) is the expected state and the npm upgrade/removal legs remain unexercised by design.
- Dependencies: Resolved — GAP-002 evidence carries at the same served authority (engine `8b9f9eee…` non-min bundle / manifest `05c4d7b7…` unchanged; src/ and package.json unchanged since its closing commit). Source CI remains distinct from downstream publication and native rendering: no check runs exist at the docs-only commits, and this qualification ran in the local harness, not CI.
- Acceptance criteria: Met. The served kit was exercised end to end (render, invalid-input diagnosis, removal); artifact hashes, notices, and lifecycle results are recorded; the registry decision is defined.
- Required checks: Existing compiler and rendered gates re-run at the candidate (`npm test` 66/66 exit 0, `npm run lint` clean); the kit driver's exit gate (inventory sha256/bytes, bundle-count equality, non-constant readback, silent valid leg, positioned invalid-DSL diagnostic, removal) enforced the run itself. No skips were introduced; both kit legs executed (no skips to count).
- Remaining limits (unchanged, non-blocking): npm publication, and with it the npm upgrade/removal legs, are deliberately deferred (registry decision above); the kit upgrade path is recorded but not exercised; Apple Silicon/Metal and other platforms remain separate qualifications; the register does not approve a release.
- Last verification: 2026-09-26. Served-kit workflow qualification is evidenced at the commit carrying this record.

### GAP-004: platform and host-version qualification

- Status: blocked. Priority: P2. Category: verification.
- Affected scope: Rendered parity, installed-consumer, and kit-consumer evidence outside Linux/headless SwiftShader; three.js versions above 0.171.0; live (non-injected) external inputs.
- Expected behavior: Every declared supported platform and host version is measured with recorded environments.
- Observed behavior: All platform evidence was measured on Linux/headless SwiftShader only. The audit environment has no macOS, Windows, or real-GPU host. The highest verified three.js version is now `0.186.1` (npm `dist-tags.latest`, checked 2026-09-26): `parity/installed-consumer.mjs` was run in an isolated npm consumer at three 0.186.1 on Linux and passed the driver gate (STATUS.md "Installed consumer at three.js `0.186.1` 2026-09-26"; exit 0, zero console/page errors, enforced vendor hashes `8b9f9eee…`/`05c4d7b7…`, 210/210 mini-bundles; tarball `80c36bb5…`, 467 files). STATUS.md's Known limits "Platform" bullet was corrected this pass: it previously named the historical Apple Silicon/Metal verification without scoping it; it now records that the historical run predates the 2026-09-26 Linux qualification and that no platform beyond Linux/headless SwiftShader is currently measured.
- Evidence: GAP-001, GAP-002, and GAP-003 records; STATUS.md "Installed consumer at three.js `0.186.1` 2026-09-26", "Full qualification 2026-09-26" and "Known limits"; section 3 review block; npm registry dist-tags.
- Next action: On an Apple Silicon/Metal host, run the three committed sweeps. Then run both consumer drivers there. The Linux `0.186.1` installed-consumer leg is done (passed, see Observed behavior).
- Dependencies: A macOS/Apple Silicon host and a Windows host. Neither exists in this audit environment. The 0.186.1 check needs no new host.
- Acceptance criteria: Each platform reports the unchanged denominators (304 programs, 13 stateful, 88 corpus) with every case executed and each named difference recorded. The 0.186.1 consumer run passes the driver gate or records its failure.
- Required checks: `parity/sweep-programs.mjs`, `parity/sweep-stateful.sh`, `npm run parity`, `parity/installed-consumer.mjs`, `parity/kit-consumer.mjs`, per platform.
- Last verification: 2026-09-26 (blocked state recorded; no platform beyond Linux measured; the 0.186.1 Linux consumer leg passed the driver gate this pass — see Observed behavior).

### GAP-005: source updates republish the served kit without a rendered-parity CI gate

- Status: blocked. Priority: P2. Category: release.
- Affected scope: `.github/workflows/export-kit.yml` push filters, scaffold's export-kit release gate, the served kit, and release evidence.
- Expected behavior: A source or dependency change cannot republish the served kit before the rendered parity gates pass at that exact source.
- Observed behavior: The repository's only workflow is the export-kit dispatcher. It runs no tests and no parity sweeps. A push that changes `src/**` or `package-lock.json` dispatches a kit build directly. Scaffold's kit release gate validates packaging structure (inventories, hashes, template tokens, import maps) and runs no rendered comparison and no repository unit gate. Rendered parity at source updates is detected only by scheduled audits after publication.
- Evidence: `.github/workflows/export-kit.yml` (dispatch step only, read 2026-09-26); scaffold `export-kit-release.yml` "Validate kit (release gate)" step; scaffold `apps/export-kit-builder/tests/kits-web.node-test.js` (structure checks; its render is a text render). Zero check-runs at `1822646`, `66e05c5`, `bbef999` (API, 2026-09-26). Latest kit run 35954455774 passed at `815d35fb`.
- Next action: The implementation job adds a rendered-parity gate through existing CI. The gate runs `parity/sweep-programs.mjs` (304), `parity/sweep-stateful.sh` (13), and `npm run parity` (88) for pushes that change `src/**`, `package-lock.json`, or `export-kit/**`, before the kit dispatch.
- Dependencies: The separate implementation job owns workflow configuration. This audit cannot change it. This run prepared the gate (see "Prepared gate") but the publication control rejected every workflow-change candidate — `d32d5c7`, `42f26f4`, `b018798`, 2026-09-26 — with "workflow changes require explicit job authority". No automated path exists: the repository's only workflow is `.github/workflows/export-kit.yml` and the scaffold-side gate is outside this job's writable scope.
- Prepared gate (executed in the run environment at base `9be956eeace45eb563944b2afb244c3a73f91c11` on 2026-09-26; execution is not independently verifiable from repository content and is not the required exact-source CI evidence): a `parity` job in `.github/workflows/export-kit.yml` — checkout, Node 26, `npm ci`, `npx playwright install --with-deps chromium-headless-shell`, `python3 -m venv parity/.venv` plus `parity/requirements.txt` (numpy, pillow for `parity/compare.py`), `bash vendor/fetch.sh`, `npm run lint`, `npm test`, then the three rendered sweeps — with the `dispatch` job changed to `needs: parity` at the same `github.sha`. Local result at the base source: `node parity/sweep-programs.mjs` PASS=304 FAIL=0 ERR=0 worst=0 exit 0; `bash parity/sweep-stateful.sh` worst=0 exit 0; `npm run parity` PASS=81 FAIL=0 ERR=7 worst=0 exit 0 (7 documented golden-side S001 ERRs); `npm test` 66/66 exit 0; `npm run lint` clean. Action pins resolved against the GitHub API (`actions/checkout` v6.0.3, `actions/setup-node` v6.5.0).
- Acceptance criteria: An exact-source CI run at a commit that changes `src/**` shows the three rendered gates executed and passing before the kit publishes.
- Required checks: Exact-source Actions runs and the served kit version after the gated push.
- Last verification: 2026-09-26 (absence verified; no gate exists; the prepared gate above was executed green locally but is unpublished — blocked on explicit workflow-change authority).

## 5. Ordered next actions

Current first action: GAP-005 — add the source-update rendered-parity CI gate. GAP-004 stays blocked on unavailable macOS and Windows hosts (its Linux 0.186.1 consumer leg passed 2026-09-26).
Subsequent actions depend on that evidence. GAP-005 is blocked at publication: the prepared gate was executed green locally at the base source (see GAP-005 "Prepared gate") but the publication control rejects workflow changes from this job pending an explicit authority grant, so the gate remains unpublished.

1. Close GAP-005 in the implementation job. A push that changes `src/**`, `package-lock.json`, or `export-kit/**` must run the three rendered gates before the kit republishes. Acceptance: exact-source CI evidence at a src-changing commit.
2. Clear GAP-004 when a host exists. Re-run the three sweeps and both consumer drivers on Apple Silicon/Metal and record the results. The installed consumer at three.js 0.186.1 passed on Linux 2026-09-26; the remaining host legs are the platform sweeps and both consumer drivers on macOS/Apple Silicon and Windows. Acceptance: unchanged denominators with every case executed.
3. Keep GAP-001 evidence current. Re-run the compiler and rendered gates at each authority or source change. — Re-verified 2026-09-26 at `1822646` and at this review's source.
4. Record measured results. Close entries only when their acceptance criteria pass.

Implementation belongs to the separate job. Do not port additional effects or advance the current parity checkpoint through this register.

## 6. Pass history

2026-09-26 GAP-005 blocked at base `9be956eeace45eb563944b2afb244c3a73f91c11` (this register's containing commit at run time; see `git log`): the rendered-parity gate candidate for `.github/workflows/export-kit.yml` (parity job with lint, unit tests, and the three rendered sweeps at the exact push SHA; `dispatch` needs `parity`) was prepared and executed green locally at that source (programs 304/304 worst=0 exit 0, stateful 13 worst=0 exit 0, corpus 81 PASS plus 7 identified golden-side S001 ERR over 88 exit 0, `npm test` 66/66, lint clean). The publication control rejected the workflow-change candidate three times — `d32d5c7`, `42f26f4`, `b018798` — with "workflow changes require explicit job authority"; the change was withdrawn unpublished and GAP-005 is recorded blocked. No served kit, workflow, or closure changed.

2026-09-26 GAP-004 partial at `da1849915bdbdfee221d59bacc8f5cc83e69ad3d` (this register's containing commit at run time; see `git log`): the gap's Linux host-version leg was executed — `parity/installed-consumer.mjs` in an isolated npm consumer at three.js `0.186.1` (npm `dist-tags.latest`) passed the driver gate, exit 0, zero console/page errors, enforced vendor hashes `8b9f9eee…`/`05c4d7b7…`, 210/210 mini-bundles; STATUS.md Known limits "Platform" bullet corrected to scope the historical Apple Silicon/Metal claim. GAP-004 remains blocked: no macOS/Apple Silicon or Windows host exists in this environment, so the per-platform sweep and consumer-driver legs are unmeasured. `npm test` 66/66 and lint clean at the candidate. Evidence: STATUS.md "Installed consumer at three.js `0.186.1` 2026-09-26".

2026-09-25 daily review at `05f599274ed11e6d0778b7a21978f058f2b47c06`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json). No new closure claimed.

2026-09-26 daily review at `bbef9990b3515acf16213a6c5a088a9edd702b1c`: every gate and both consumer drivers re-executed independently, all exit 0. GAP-001, GAP-002, and GAP-003 closures verified and retained. GAP-004 (platform and host-version qualification, blocked) and GAP-005 (source-update rendered-parity CI gate, open) added. Evidence: `/series/review-20260926-133500/result.json`.

| Date | Source SHA | Changes | Tested scope | Remaining limits |
|---|---|---|---|---|
| 2026-09-26 | `bbef9990b3515acf16213a6c5a088a9edd702b1c` | Daily review: every gate and both consumer drivers re-executed independently (programs 304/304 worst=0, stateful 13 bit-exact, corpus 81 PASS plus 7 golden-side ERR over 88, `npm test` 66/66, lint clean; installed consumer pass at three 0.160.0 and 0.171.0 with enforced vendor hashes; kit consumer verdict pass). GAP-001, GAP-002, and GAP-003 closures verified and retained. Added GAP-004 (blocked) and GAP-005 (open). Evidence: `/series/review-20260926-133500/result.json`. | Linux/headless SwiftShader, Node v26.5.1; served authority `v1.0.185` = `6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa`, bundle `8b9f9eee…`, manifest `05c4d7b7…`; zero check-runs at the docs-only commits; registry 404. | GAP-004 blocked on unavailable macOS and Windows hosts; npm `three` latest 0.186.1 unmeasured; GAP-005 open until CI enforces rendered parity at source updates; this register does not approve a release. |
| 2026-09-26 | `1822646f9d6d90a164a5146f4db571eea2b98202` | Completion audit: full parity re-executed at the audited source (programs 304/304 worst=0, stateful 13 bit-exact, corpus 81 PASS + 7 identified ERR over 88, `npm test` 66/66, lint clean). Served kit `0.1.5` byte-verified against inventory and source; npm registry 404 recorded. GAP-001's closure is re-verified by fresh execution; GAP-002's closure is carried (src/ and package.json unchanged since 66b4291, identical served bundle); GAP-003 updated, still open. Evidence: `/series/evidence-audit-20260926-101500/result-noisemaker-for-threejs.json`. | Linux/headless SwiftShader; authority `v1.0.185` = `6a0af04d3c4f345ffab5e9f8e54e532216b4cdaa`, served bundle `8b9f9eee…` unchanged; all 210 effects plus mode variants covered. | Kit host workflow, npm publication, upgrade, removal, Apple Silicon/Metal, and live external inputs remain unqualified. |
| 2026-09-26 | This register's containing commit (see `git log`) | GAP-001 closed: authority `v1.0.183` = `8eeb7b5a` pinned by hash; full programs (304/304 worst=0), stateful (13 bit-exact), and corpus (81 PASS + 7 named ERR over 88) sweeps with exact frame comparisons; `npm test` 66/66, lint clean. Raw output in STATUS.md "Full qualification 2026-09-26". | Linux/headless SwiftShader; full current roster + modes + stateful + corpus denominator preserved. | `filter/text` recorded untested at closure; the same-day audit sweep executed and passed it in-suite (font-raster scope in STATUS Known limits). Apple Silicon/Metal and live external inputs remain separate qualifications (GAP-002/003 unaffected). |
| 2026-09-26 | This register's containing commit (see `git log`) | GAP-002 closed: tarball `de3fc2ff…` installed into isolated consumers at three 0.160.0 (peer floor) and 0.171.0; texture-on-mesh, EffectComposer pass, resize 480×320, invalid-DSL `L004` diagnostic + valid-DSL recovery, dispose (153→2 textures, 8→1 programs); zero console/page errors; `npm test` 66/66, lint clean at the candidate. Raw output in STATUS.md "Installed consumer qualification 2026-09-26". | Linux/headless SwiftShader (Chrome Headless Shell 149.0.7827.55); engine `8b9f9eee…` (870700 bytes) fetched inside each installed package; mesh/pass/dispose screenshots byte-identical across both three versions. | Apple Silicon/Metal untested; byte-stability at resized targets not claimed (sub-LSB SwiftShader variance); npm publication/upgrade/removal and served kit remain GAP-003. |
| 2026-09-26 | This register's containing commit (see `git log`) | GAP-003 closed: served kit `0.1.5` exercised end to end in an isolated consumer via the committed `parity/kit-consumer.mjs` (17/17 inventory sha256+bytes; engine `v1.0.185`, import-map core `31b76609…`/412659 bytes, manifest `05c4d7b7…` unchanged, 210/210 bundles; valid program rendered `running` with live readback min 86 / max 192.667 / mean 138.346, zero console/page errors; `.write(o9)` invalid leg showed the engine's positioned `SyntaxError` diagnostic on screen; removal verified). Registry decision recorded: export kit is the qualified distribution; npm publication deferred to an owner release action (404 expected until then). `npm test` 66/66, lint clean at the candidate. Raw output in STATUS.md "Kit consumer qualification 2026-09-26"; screenshots `053d70a6…`, `bcb57da7…`. | Linux/headless SwiftShader (Chrome Headless Shell 149.0.7827.55); kit served from the production distribution, not this checkout; both kit legs executed, no skips. | npm publication and the npm upgrade/removal legs deliberately deferred (registry decision); kit upgrade path recorded, not exercised; Apple Silicon/Metal and other platforms remain separate qualifications; this register does not approve a release. |
| 2026-09-24 | `815d35fb3365d66a078f0eee155b14709e9ae9f2` | Created six-section register and README link. No closures. | 51 Node tests passed. The full browser image sweep and installed consumer workflow were not executed. | Full audit, installed workflows, current rendered parity, platforms, and releases remain unqualified. |

Run ID: `audit-20260926-101500` (worker), `review-20260926-133500` (review). Earlier run: `20260924-remaining-gap-documents`.
[Operational evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents) (historical provenance, source host). Current audit evidence: `/series/evidence-audit-20260926-101500/`. Creating this register does not advance successful-audit timestamps or the rotation.
