# noisemaker-for-threejs: completion gaps

Current compatibility matrix: [compatibility report](COMPATIBILITY.md).

## 1. Scope and source revisions

Daily review: 2026-09-25. Current inspected source: [`05f599274ed11e6d0778b7a21978f058f2b47c06`](https://github.com/noisefactorllc/noisemaker-for-threejs/commit/05f599274ed11e6d0778b7a21978f058f2b47c06).
Full rendered parity remains **unverified**. No release approval or new closure follows from this review.
Current upstream discovery: `bbdeb56c4b75cf33379766c3e87b0f5a18bcbba8`. Published Noisemaker authority: `1.0.179`, source `fca611fd8f91424661d4e531d39313d24ea21134`, 210 effect IDs.
The observations below retain their original source and authority identities. They do not qualify later updates.
Current served kit: `0.1.5`, source `815d35fb3365d66a078f0eee155b14709e9ae9f2`. [Retrieved inventory and hashes](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/current-served-inventories.json). Artifact identity does not establish host qualification.

### Earlier source observations

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
| CLAIM-001 | [Historical source](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/STATUS.md) | Historical catalog and mode fixtures are pixel-identical. Live inputs and broader host versions need separate qualification. | partial | 51 Node tests passed. The full browser image sweep and installed consumer workflow were not executed. |
| CLAIM-002 | [README](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md) | Human usability: installation, output, errors, and recovery | unverified | Complete installed workflows were not observed. GAP-002. |
| CLAIM-003 | [Ecosystem reference](https://threejs.org/manual/en/installation.html) | Ecosystem fit and version support | partial | Source entry points were examined. Installed integration and version qualification remain open. |
| CLAIM-004 | [README](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md) | Release readiness | unverified | Metadata and CI do not replace installation of the actual artifact. GAP-003. |
| CLAIM-005 | [Exact-source Actions](https://github.com/noisefactorllc/noisemaker-for-threejs/actions?query=head_sha%3A815d35fb3365d66a078f0eee155b14709e9ae9f2) | Workflow status only | supported | [Export kit](https://github.com/noisefactorllc/noisemaker-for-threejs/actions/runs/35954455774): `success`. |

## 3. Methods and evidence

Review CI boundary: No workflow run exists at the inspected source SHA. A passing export dispatch does not qualify rendered parity. Current complete-render enforcement remains an open verification requirement. [Exact-source responses and workflows](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/noisemaker-for-threejs-remote-evidence.json).

### Daily review, 2026-09-25

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
- Remaining limits (unchanged, non-blocking): `filter/text` untested (OS font rasterization — STATUS Known limits); this qualification ran on Linux/SwiftShader, not Apple Silicon/Metal; live (non-injected) external inputs remain out of scope.
- Last verification: 2026-09-26. Full behavior qualification for the current authority is evidenced at the commit carrying this record.

### GAP-002: installed developer workflow qualification

- Status: open. Priority: P2. Category: usability.
- Affected scope: Public API, examples, supported hosts, errors, recovery, and lifecycle.
- Expected behavior: Developers can install, produce useful output, integrate it, recover from errors, and remove the package.
- Observed behavior: This pass did not exercise the complete installed workflow or supported-version matrix.
- Evidence: [README](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md), [official reference](https://threejs.org/manual/en/installation.html), and section 3.
- Next action: Install into an isolated consumer, render a texture on a mesh, run an EffectComposer pass, resize, recover from invalid DSL, and dispose.
- Dependencies: Use an isolated consumer. Identify host, GPU, licensing, and input requirements before execution.
- Acceptance criteria: Retain artifact hashes, steps, meaningful output, error diagnostics, recovery results, and cleanup results.
- Required checks: Test minimum and current supported versions. Check cancellation and file preservation where relevant. Keep unavailable platforms explicit.
- Last verification: 2026-09-24. Source inspection does not close this gap.

### GAP-003: distribution and release qualification

- Status: open. Priority: P2. Category: release.
- Affected scope: Actual artifact, dependencies, notices, version promises, and release evidence.
- Expected behavior: The delivered artifact supports its documented installation and first useful result.
- Observed behavior: Complete artifact reproduction, installation, upgrade, and removal remain unverified.
- Evidence: [Distribution instructions](https://github.com/noisefactorllc/noisemaker-for-threejs/blob/815d35fb3365d66a078f0eee155b14709e9ae9f2/README.md), section 1, and exact-source CI in section 2.
- Next action: Pack and install the adapter into an isolated consumer. Check engine discovery, public module imports, examples, licenses, and removal.
- Dependencies: Complete GAP-002 for the candidate. Distinguish source CI from downstream publication and native rendering.
- Acceptance criteria: Match artifact bytes to their inventory. Check notices and dependencies. Pass installation, examples, upgrade, and removal.
- Required checks: Inspect exact-source CI jobs and actual render legs. Count skips and errors rather than trusting green summaries.
- Last verification: 2026-09-24. This register does not approve a release.

## 5. Ordered next actions

Current first action: Install the npm tarball in an isolated consumer at the declared Three.js floor and current supported version. Exercise texture, canvas, and EffectComposer entry points with a useful rendered graph. Compare the same immutable reference cases, then test resize, disposal, invalid-input recovery, and an external texture.
Subsequent historical actions remain dependent on that evidence. No implementation is authorized by this audit.

1. Resolve authority identities for GAP-001. Retain earlier denominators, goldens, tolerances, and exclusions. — Done 2026-09-26 (authority `v1.0.183` = `8eeb7b5a`, pinned by hash; see GAP-001).
2. Execute the installed workflow for GAP-002. Record meaningful output, failure recovery, versions, and cleanup.
3. Run compiler and rendered parity for GAP-001. Keep structural, numerical, and platform evidence separate. — Done 2026-09-26 (66/66 compiler tests; programs 304/304, stateful 13 bit-exact, corpus 81+7 ERRs identified over 88; see GAP-001).
4. Qualify distribution contents and lifecycle for GAP-003 after the installed workflow passes.
5. Record measured results. Close entries only when their acceptance criteria pass.

Implementation belongs to the separate job. Do not port additional effects or advance the current parity checkpoint through this register.

## 6. Pass history

2026-09-25 daily review at `05f599274ed11e6d0778b7a21978f058f2b47c06`: source freshness and bounded evidence reviewed. Open qualification limits retained. [Retained review evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/review-20260925-053200/threejs-current-tests.json). No new closure claimed.

| Date | Source SHA | Changes | Tested scope | Remaining limits |
|---|---|---|---|---|
| 2026-09-26 | This register's containing commit (see `git log`) | GAP-001 closed: authority `v1.0.183` = `8eeb7b5a` pinned by hash; full programs (304/304 worst=0), stateful (13 bit-exact), and corpus (81 PASS + 7 named ERR over 88) sweeps with exact frame comparisons; `npm test` 66/66, lint clean. Raw output in STATUS.md "Full qualification 2026-09-26". | Linux/headless SwiftShader; full current roster + modes + stateful + corpus denominator preserved. | `filter/text` untested; Apple Silicon/Metal and live external inputs remain separate qualifications (GAP-002/003 unaffected). |
| 2026-09-24 | `815d35fb3365d66a078f0eee155b14709e9ae9f2` | Created six-section register and README link. No closures. | 51 Node tests passed. The full browser image sweep and installed consumer workflow were not executed. | Full audit, installed workflows, current rendered parity, platforms, and releases remain unqualified. |

Run ID: `20260924-remaining-gap-documents`.
[Operational evidence](/Users/alex/.codex/automations/noisemaker-port-completion-audit/evidence-20260924-remaining-gap-documents). Creating this register does not advance successful-audit timestamps or the rotation.
