# Noisemaker for Three.js — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the noisemaker shader platform to three.js by reusing the reference JS compiler + pipeline verbatim and implementing a single `ThreeBackend`, plus a three.js integration surface.

**Architecture:** The reference (an EXTERNAL repo, located at build time via `NM_REFERENCE_ROOT` — never a fixed relative path) is pure-JS ESM: a backend-agnostic compiler (`lang/` + `runtime/{compiler,expander,resources}`) emits a RenderGraph that a reused `runtime/pipeline.js` executes against an abstract `Backend`. Because three.js is also JS, we **vendor the reference `shaders/src` tree byte-for-byte** and implement one `ThreeBackend extends Backend` on three.js primitives. All 182 effects and the full live DSL come for free; parity verification is the work.

**Tech Stack:** JavaScript (ESM, vanilla browser), three.js (peer dep, WebGL2 renderer, `RawShaderMaterial` + `GLSL3`), esbuild, Playwright (headless parity capture), Python (`compare.py`, NumPy/Pillow) for parity comparison.

## Global Constraints

- **Parity target:** reference **WebGL2/GLSL** path only. WGSL/WebGPU is out of scope for v1.
- **Never modify the vendored core.** `src/vendor/noisemaker-core/**` is byte-identical to upstream; a check enforces this. DSL/core changes are strictly additive elsewhere — never here.
- **All render targets are linear float.** `HalfFloatType` for `rgba16f`, `UnsignedByteType` for `rgba8`. Never sRGB-encode. `renderer.outputColorSpace = NoColorSpace`/`LinearSRGBColorSpace`; `renderer.autoClear = false`.
- **Use `RawShaderMaterial` with `glslVersion: THREE.GLSL3`** — never `ShaderMaterial` (it injects a three.js prelude that diverges from reference GLSL).
- **No per-frame allocations** in `executePass`/render loop (reuse uniform objects, geometry, materials).
- **Parity criterion:** `max-abs-diff ≤ 2/255` AND `SSIM ≥ 0.98` (default tolerance `2.001`); per-effect relaxations inherited from the sibling tolerance table.
- **An effect is "done" only when `compare.py` exits 0 with shown output.** Evidence before assertions.
- **Vanilla JS ESM** for all new code. Public API additionally ships `.d.ts`.
- **No Claude attribution on commits. Do not push without explicit instruction.**
- three.js version pinned at Phase 0; verify `GLSL3`, `WebGLRenderTarget {count}` (MRT), `Data3DTexture`, `WebGLCubeRenderTarget` exist in the installed version.

---

## Phase 0 — Scaffold & Vendor

### Task 0.1: package.json, deps, three.js capability check

**Files:**
- Create: `package.json`, `.gitignore`, `eslint.config.js`
- Create: `test/three-capabilities.test.mjs`

**Interfaces:**
- Produces: an installed, version-pinned `three`; npm scripts `test`, `lint`, `build`, `sync`, `parity`.

- [ ] **Step 1:** Write `package.json`:

```json
{
  "name": "noisemaker-for-threejs",
  "version": "0.0.1",
  "description": "noisemaker shader platform for three.js",
  "type": "module",
  "license": "MIT",
  "peerDependencies": { "three": ">=0.160.0" },
  "devDependencies": {
    "three": "^0.171.0",
    "esbuild": "^0.28.1",
    "@playwright/test": "^1.61.0",
    "pngjs": "^7.0.0",
    "eslint": "^10.5.0"
  },
  "scripts": {
    "sync": "node tools/sync-upstream.mjs",
    "test": "node --test test/",
    "lint": "eslint src/ tools/ test/",
    "build": "node tools/build.mjs",
    "parity": "bash parity/run.sh"
  }
}
```

- [ ] **Step 2:** Write `.gitignore`:

```
node_modules/
dist/
parity/out/
parity/.venv/
*.log
```

- [ ] **Step 3:** `npm install`. Run: `npm ls three`. Expected: a concrete pinned version (record it in `ARCHITECTURE.md`).

- [ ] **Step 4:** Write `test/three-capabilities.test.mjs` (fails if installed three.js lacks required features):

```js
import { test } from 'node:test'
import assert from 'node:assert'
import * as THREE from 'three'

test('three.js exposes GLSL3', () => assert.ok(THREE.GLSL3))
test('three.js exposes Data3DTexture', () => assert.equal(typeof THREE.Data3DTexture, 'function'))
test('three.js exposes WebGLCubeRenderTarget', () => assert.equal(typeof THREE.WebGLCubeRenderTarget, 'function'))
test('WebGLRenderTarget supports MRT count option (constructor accepts {count})', () => {
  // Smoke check the option is accepted (no GL context needed for shape check).
  const rt = new THREE.WebGLRenderTarget(2, 2, { count: 2 })
  assert.ok(Array.isArray(rt.textures) && rt.textures.length === 2)
})
```

- [ ] **Step 5:** Run: `npm test`. Expected: 4 PASS. If MRT `count` test fails, bump three.js to a version with MRT support and re-pin.

- [ ] **Step 6:** Commit. `git add -A && git commit -m "chore: scaffold noisemaker-for-threejs, pin three.js, capability gate"`

### Task 0.2: Vendor sync script (full tree, byte-identical) + closure verification

**Files:**
- Create: `tools/sync-upstream.mjs`
- Create: `src/vendor/UPSTREAM.json` (written by the script)
- Create (synced): `src/vendor/noisemaker-core/**`, `assets/effects/**`

**Interfaces:**
- Consumes: the EXTERNAL reference repo (`$NM_REFERENCE_ROOT`), trees `shaders/src/**` + `shaders/effects/**`. No sibling checkout is assumed.
- Produces: vendored core importable as `src/vendor/noisemaker-core/runtime/compiler.js` etc.; `assets/effects/<ns>/<name>/{definition.js,glsl/*}`; `assets/effects/manifest.json`.

- [ ] **Step 1:** Write `tools/sync-upstream.mjs` that:
  1. Resolves `REF` from `--ref <path>` / `NM_REFERENCE_ROOT` (no sibling path assumed; errors if absent). Reads `git -C $REF rev-parse HEAD`.
  2. Recursively copies `$REF/shaders/src/**` → `src/vendor/noisemaker-core/**` **verbatim** (full tree — needed because `runtime/pipeline.js` eagerly imports `backends/webgl2.js`, `backends/webgpu.js`, `renderer/cubeCamera.js`).
  3. Recursively copies `$REF/shaders/effects/**` → `assets/effects/**`.
  4. Runs the reference manifest generator (`node $REF/shaders/scripts/generate-shader-manifest.mjs`) or re-implements its directory walk to emit `assets/effects/manifest.json` (`{ namespaces: {<ns>: [<name>...]} }`).
  5. Writes `src/vendor/UPSTREAM.json`: `{ "repo": "noisemaker", "commit": "<hash>", "syncedAt": "<ISO from process arg>", "tree": "shaders/src" }`.
  6. **Closure check:** statically scan every `import ... from '...'` under `src/vendor/noisemaker-core/`; assert every relative import resolves to a file *inside* the vendored tree, **except** `renderer/canvas.js` and `index.js` (which import `../../demo/**` and are never in our import closure). Print the escaping-import list; exit nonzero if any escape outside that allowlist.

- [ ] **Step 2:** Run: `npm run sync`. Expected: prints synced file count, the upstream commit, and "closure OK (canvas.js/index.js externals ignored)".

- [ ] **Step 3:** Add a byte-identity guard `test/vendor-integrity.test.mjs` that is
  **self-contained** — it must NOT reach for the external reference repo, so it runs on any clone /
  CI. `sync` writes a committed sha256 manifest of every vendored file
  (`src/vendor/vendor-manifest.json`, via `tools/vendor-manifest.mjs`); the test recomputes the
  hashes and asserts they match (and that no file was added or removed). A divergence means a
  vendored file was hand-edited (forbidden) or the manifest is stale (re-run `npm run sync`).

```js
import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { buildManifest, MANIFEST_PATH } from '../tools/vendor-manifest.mjs'

test('vendored core matches the committed integrity manifest (sha256)', () => {
  const { files: recorded } = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const actual = buildManifest()
  const mismatches = Object.keys(recorded).filter((rel) => actual[rel] !== recorded[rel])
  assert.equal(mismatches.length, 0, `vendored files diverge:\n  ${mismatches.slice(0, 15).join('\n  ')}`)
})
```

(Implementer note: also assert the file SET matches — no untracked additions, no deletions — so a
removed/added vendored file is caught, not just a content change.)

- [ ] **Step 4:** Run `npm test`. Expected: PASS.

- [ ] **Step 5:** Commit. `git add -A && git commit -m "feat: vendor reference core (full shaders/src tree) + effect assets + manifest"`

### Task 0.3: Verify the reused compiler runs in-repo

**Files:**
- Create: `test/compile-graph.test.mjs`

**Interfaces:**
- Consumes: `src/vendor/noisemaker-core/runtime/compiler.js` (`compileGraph`), effect registration.
- Produces: proof that `compileGraph('search synth\nsolid().render(o0)')` yields a RenderGraph with `passes`, `programs` (each with a GLSL `fragment` string), `textures`, `renderSurface`.

- [ ] **Step 1:** Write `src/effects/loader.js` exposing `async function registerEffects(ids)` that, for each id `<ns>/<name>`, dynamic-imports `assets/effects/<ns>/<name>/definition.js`, reads its `glsl/*.glsl` as text, attaches sources to the Effect's programs, and calls the vendored `registerEffect`. (Mirror how the reference inlines shader files at bundle time.)

- [ ] **Step 2:** Write `test/compile-graph.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import { registerEffects } from '../src/effects/loader.js'
import { compileGraph } from '../src/vendor/noisemaker-core/runtime/compiler.js'

test('compileGraph produces a GLSL render graph for solid', async () => {
  await registerEffects(['synth/solid'])
  const g = compileGraph('search synth\nsolid().render(o0)')
  assert.ok(Array.isArray(g.passes) && g.passes.length >= 1)
  const prog = Object.values(g.programs)[0]
  assert.ok(typeof prog.fragment === 'string' && prog.fragment.includes('void main'))
  assert.ok(g.renderSurface)
})
```

- [ ] **Step 3:** Run: `node --test test/compile-graph.test.mjs`. Iterate `loader.js` until PASS (this validates the asset-loading contract end to end, no GPU needed).

- [ ] **Step 4:** Commit. `git add -A && git commit -m "feat: effect loader + compileGraph smoke test (compiler reused in-repo)"`

### Task 0.4: Copy parity harness from sibling

**Files:**
- Create (copied): `parity/compare.py`, `parity/programs/*.dsl`, `parity/run.sh`, `parity/sweep.sh`
- Create: `tools/export-graph.mjs` (copied/retargeted), `parity/export-golden.mjs` (adapted from sibling `export-and-render.mjs`)
- Create (copied): `reference/01..10-*.md`

- [ ] **Step 1:** Copy a sibling reference port's `parity/{compare.py,programs}` and `reference/*.md` into this repo verbatim.
- [ ] **Step 2:** Copy that port's `tools/export-graph.mjs` → `tools/export-graph.mjs`; point its reference path at `$NM_REFERENCE_ROOT` (it runs the **unchanged reference** `compileGraph`).
- [ ] **Step 3:** Adapt that port's `parity/export-and-render.mjs` → `parity/export-golden.mjs`: emits `parity/out/<name>.golden.png` via the reference's own headless WebGL2 render at `--size 256`.
- [ ] **Step 4:** Run: `node tools/export-graph.mjs --file parity/programs/solid.dsl parity/out/solid.graph.json`. Expected: valid JSON written.
- [ ] **Step 5:** Run: `node parity/export-golden.mjs solid parity/out --size 256 --backend webgl2`. Expected: `parity/out/solid.golden.png` exists (256×256).
- [ ] **Step 6:** Commit. `git add -A && git commit -m "chore: import parity harness + reference specs from sibling port"`

---

## Phase 1 — Golden Assets (Tier-1)

### Task 1.1: Generate Tier-1 golden graphs + PNGs

**Files:** writes to `parity/out/`

Tier-1 set: `solid, noise, cell, gradient, shape, osc2d, blur, blendMode`.

- [ ] **Step 1:** For each name in the Tier-1 set, run `node tools/export-graph.mjs --file parity/programs/<name>.dsl parity/out/<name>.graph.json`.
- [ ] **Step 2:** For each, run `node parity/export-golden.mjs <name> parity/out --size 256 --backend webgl2`.
- [ ] **Step 3:** Verify 8 `*.golden.png` (256×256) + 8 `*.graph.json` exist. Run: `ls parity/out/*.golden.png | wc -l` → `8`.
- [ ] **Step 4:** Commit golden graphs only (PNGs are gitignored): `git add parity/out/*.graph.json && git commit -m "test: Tier-1 golden graphs"`

---

## Phase 2 — ThreeBackend MVP + first parity

### Task 2.1: Resource primitives (RT pool, fullscreen geometry, material cache)

**Files:**
- Create: `src/backend/three-resources.js`
- Test: `test/three-resources.test.mjs`

**Interfaces:**
- Produces:
  - `class TextureStore` — `create(id, spec) -> {target}`, `get(id)`, `destroy(id)`, `clear(id, renderer)`; maps `spec.format` (`'rgba16f'|'rgba8unorm'`) → three.js `type`; allocates `WebGLRenderTarget`.
  - `fullscreenTriangle()` -> `THREE.BufferGeometry` with `a_position` attribute = `[-1,-1, 3,-1, -1,3]`.
  - `DEFAULT_VERTEX_SHADER` (string, copied from vendored `runtime/default-shaders.js`).

- [ ] **Step 1:** Write failing test `test/three-resources.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import * as THREE from 'three'
import { fullscreenTriangle, formatToType } from '../src/backend/three-resources.js'

test('fullscreen triangle has 3 verts on a_position', () => {
  const g = fullscreenTriangle()
  assert.equal(g.getAttribute('a_position').count, 3)
})
test('rgba16f maps to HalfFloatType', () => {
  assert.equal(formatToType('rgba16f'), THREE.HalfFloatType)
})
```

- [ ] **Step 2:** Run: `node --test test/three-resources.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/backend/three-resources.js`:
  - `formatToType(fmt)` → `{ rgba16f: THREE.HalfFloatType, rgba8unorm: THREE.UnsignedByteType }[fmt] ?? THREE.HalfFloatType`.
  - `fullscreenTriangle()` builds geometry with `a_position` (`new THREE.BufferAttribute(new Float32Array([-1,-1,3,-1,-1,3]), 2)`).
  - `TextureStore` wrapping a `Map<id, WebGLRenderTarget>`; `create` uses `{ type: formatToType, format: RGBAFormat, depthBuffer: !!spec.depth, magFilter/minFilter per spec (default NearestFilter unless floatLinear), wrapS/T: ClampToEdge }`.
  - Export `DEFAULT_VERTEX_SHADER` (paste from vendored default-shaders.js).
- [ ] **Step 4:** Run test. Expected: PASS.
- [ ] **Step 5:** Commit. `git commit -am "feat(backend): RT store, fullscreen triangle, format mapping"`

### Task 2.2: ThreeBackend MVP (single-output passes) + pipeline glue

**Files:**
- Create: `src/backend/three-backend.js`
- Create: `src/runtime/create-three-pipeline.js`
- Test: `test/three-backend-unit.test.mjs` (headless GL via Playwright in Task 2.3; unit-test the pure bits here)

**Interfaces:**
- Produces:
  - `class ThreeBackend extends Backend` with: `init`, `createTexture`, `compileProgram`, `executePass`, `beginFrame`, `endFrame`, `present`, `destroyTexture`, `clearTexture`, `readPixels`, `destroy`. (Stub `createTexture3D`, `uploadDataTexture`, `updateTextureFromSource`, `copyTexture` to throw "not yet implemented" — filled in Phase 3/5.)
  - `async function createThreePipeline(graph, { renderer, width, height }) -> Pipeline` — replicates the vendored `createPipeline` init sequence (instantiate backend, `await backend.init()`, allocate textures from `graph.textures`, compile `graph.programs`) but injects `ThreeBackend` and returns `new Pipeline(graph, backend)`.

- [ ] **Step 1:** Read the vendored `runtime/pipeline.js` `createPipeline(graph, options)` body; transcribe its init order into `createThreePipeline` (same steps, `ThreeBackend` instead of `WebGL2Backend`). Read `executePass` in vendored `backends/webgl2.js` as the behavioral spec for the three.js version.
- [ ] **Step 2:** Implement `compileProgram(id, spec)`:
  - `frag = injectDefines(spec.source || spec.glsl || spec.fragment, spec.defines)` — replicate webgl2's `injectDefines` (strip existing `#version`, prepend `#version 300 es` is implicit via `glslVersion`; prepend `#define`s).
  - Build `uniforms` object from spec; `new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: DEFAULT_VERTEX_SHADER (or spec.vertex), fragmentShader: frag, uniforms, depthTest:false, depthWrite:false })`. Store in `this.programs`.
- [ ] **Step 3:** Implement `executePass(pass, state)` for the single-output render case:
  - Resolve material from `pass.program`; set `material.uniforms[k].value` for each uniform in `pass.uniforms` and the global uniforms in `state.globalUniforms` (`resolution`, `time`, `frame`, `tileOffset`, `fullResolution`, `aspect`, …). Bind input textures: for each `pass.inputs[name] = texId`, set `material.uniforms[name].value = this.textures.get(texId).texture`.
  - Set the mesh's material; `renderer.setRenderTarget(this.textures.get(pass.outputs.color).target)`; `renderer.render(this.scene, this.camera)`.
- [ ] **Step 4:** Implement `present(textureId)`: blit `this.textures.get(textureId).texture` to `renderer.setRenderTarget(null)` via a cached blit material; respect orientation.
- [ ] **Step 5:** Implement `readPixels(textureId)` → `{width,height,data}` using `renderer.readRenderTargetPixels`; **row-flip to match the reference's bottom-up readback** (reference flips rows; see webgl2.js readback).
- [ ] **Step 6:** Unit-test the pure helpers (`injectDefines`, uniform-name resolution) in `test/three-backend-unit.test.mjs`. Run: PASS.
- [ ] **Step 7:** Commit. `git commit -am "feat(backend): ThreeBackend MVP (single-output) + createThreePipeline glue"`

### Task 2.3: NoisemakerCanvas + headless candidate render + FIRST PARITY GATE

**Files:**
- Create: `src/integration/canvas.js`, `src/index.js`
- Create: `parity/render-candidate.mjs` (Playwright headless), `parity/page.html`
- Modify: `parity/run.sh` (wire candidate render + compare)

**Interfaces:**
- Produces: `class NoisemakerCanvas` — `constructor(canvas, opts)`, `async compile(dsl)`, `start()`, `stop()`, `resize(w,h)`, `renderOnce()`, `readPixels()`. Owns `new THREE.WebGLRenderer({ canvas })` with color management disabled.

- [ ] **Step 1:** Implement `NoisemakerCanvas`: build renderer (`outputColorSpace = NoColorSpace`, `autoClear=false`); `compile(dsl)` = `registerEffects(extractEffectsFromDsl(dsl))` → `compileGraph(dsl)` → `createThreePipeline(...)`; `renderOnce()` = `pipeline.render(t)`; `readPixels()` delegates to backend.
- [ ] **Step 2:** Export from `src/index.js`: `NoisemakerCanvas`, `NoisemakerTexture` (Phase 6), `NoisemakerPass` (Phase 6), `compileGraph`, `VERSION`.
- [ ] **Step 3:** Write `parity/page.html` + `parity/render-candidate.mjs`: launches headless Chromium (system Chrome), loads the page, runs `NoisemakerCanvas`, renders N settle frames at 256×256, reads pixels, writes `parity/out/<name>.candidate.png` (via pngjs).
- [ ] **Step 4:** Wire `parity/run.sh <name>`: export graph (golden), export-golden PNG, render candidate PNG, then `python parity/compare.py parity/out/<name>.golden.png parity/out/<name>.candidate.png --name <name> --tolerance 2.001 --ssim-min 0.98`.
- [ ] **Step 5 — GATE A:** Run: `bash parity/run.sh solid`. Expected: `compare.py` exits 0 (PASS). Debug ThreeBackend until it passes.
- [ ] **Step 6 — GATE B (Y-origin):** Run: `bash parity/run.sh gradient`. Expected: PASS. If inverted, fix orientation **once** in `present`/`readPixels` (not per-effect) and re-gate `solid`+`gradient`.
- [ ] **Step 7:** Commit. `git commit -am "feat: NoisemakerCanvas + headless parity; solid & gradient PASS (Gate A/B)"`

---

## Phase 3 — Full Backend

Each task adds one capability and is gated by an effect that exercises it. Behavioral spec = the vendored `backends/webgl2.js`.

### Task 3.1: Multi-pass + RT pool/liveness (gate: `blur`)
- [ ] Implement intermediate (`node_*`) texture allocation honoring the graph's `textures` specs and `resources.js` liveness (`phys_N`); reuse pooled targets across passes.
- [ ] Implement per-pass viewport overrides (`pass.viewport` with `{param,power,inputOverride}`).
- [ ] **Gate:** `bash parity/run.sh blur` → PASS. Commit.

### Task 3.2: Ping-pong surfaces + feedback (gate: `feedback`)
- [ ] Confirm double-buffered `o0..o7` and `global_*` state surfaces: `createTexture` allocates read+write; `present`/swap is driven by the reused `pipeline.js` (`swapBuffers`, `updateFrameSurfaceBindings`). `ThreeBackend` exposes whichever handle pipeline binds.
- [ ] Implement `clearTexture` and the `blit` program (used by `.write()` passes).
- [ ] **Gate:** `bash parity/run.sh feedback` → PASS (run ≥8 settle frames). Commit.

### Task 3.3: Two-input + blend + repeat (gates: `blendMode`, an additive-blend effect)
- [ ] Bind multiple named input samplers per pass; implement additive `blend:true` (set material `blending=AdditiveBlending`, `transparent`, no depth) matching webgl2.
- [ ] Honor `pass.repeat` (count resolved by pipeline; backend just executes the pass as invoked).
- [ ] **Gate:** `bash parity/run.sh blendMode` → PASS. Commit.

### Task 3.4: MRT + points/billboards draw modes (gates: a points effect)
- [ ] MRT: when `pass.outputs` has >1 key or `pass.drawBuffers>1`, render to N attachments.
  - **DESIGN CONSTRAINT (verified 2026-06-20):** MRT attachments can have MIXED formats —
    e.g. `pointsEmit` writes `global_xyz`/`global_vel` (`rgba32f`) + `global_rgba` (`rgba8`)
    in one pass. three.js `WebGLRenderTarget({count:N})` uses ONE format for all attachments,
    so it CANNOT represent this. Options: (a) raw-GL FBO attaching the N separate surface
    write-textures' underlying `__webglTexture`s with `gl.drawBuffers` (faithful, like the
    reference `createMRTFBO`) + render the three.js material to it (needs overriding the
    RT framebuffer via `renderer.properties` internals, or a custom RT subclass); (b) widen
    all attachments to `rgba32f` and quantize the rgba8 one on read (risks parity at the
    8-bit boundary). (a) is correct; prototype it on `pointsEmit`.
  - **Parity risk:** agent sims (physarum/flow/dla/lenia/life) are chaotic like reactionDiffusion
    — verify seed/early-frame bit-exactness before trusting multi-frame output.
  - **Goldens ARE obtainable** for points effects via the reference harness (verified:
    `noise().pointsEmit().flow().pointsRender().write(o0)` goldens fine). So Phase 3 is
    parity-verifiable, not blocked.
- [ ] `drawMode:"points"`: `THREE.Points` with a `count`-sized empty geometry; `gl_PointSize` from the effect VS; `count` resolution (`auto`/`input`/`screen`) mirrors webgl2.
- [ ] `drawMode:"billboards"`: 6 verts/particle triangle list.
- [ ] **Gate:** `bash parity/run.sh <points effect, e.g. pointsRender>` → PASS or documented-divergence. Commit.

### Task 3.5: Uniform-type completeness + external input stubs
- [ ] Ensure all uniform types bind correctly: float/int/bool, vec2/3/4, color, arrays, sampler2D/3D. Add a unit test compiling a synthetic program exercising each type.
- [ ] Implement `uploadDataTexture` (→ `DataTexture`) and `updateTextureFromSource` (→ `Texture` from canvas/video, `flipY` honored). MIDI/audio uniforms come via reused `external-input.js` through pipeline state.
- [ ] Commit.

---

## Phase 4 — Tier-1 → Parity (critical milestone)

### Task 4.1: Drive all 8 Tier-1 effects to PASS

**Per-effect procedure (the template; run for each of `noise, cell, gradient, shape, osc2d, blur, blendMode, solid`):**

- [ ] **Step 1:** `bash parity/run.sh <name>`.
- [ ] **Step 2:** If PASS → record in coverage table, next effect.
- [ ] **Step 3:** If FAIL → use superpowers:systematic-debugging. Compare candidate vs golden diff image (`compare.py` writes one); inspect the offending pass's uniforms/inputs vs webgl2.js behavior. Fix in `ThreeBackend` (never in vendored core, never per-effect hacks). Re-run.
- [ ] **Step 4:** Commit per passing effect: `git commit -am "test(parity): <name> PASS"`.

- [ ] **MILESTONE:** `bash parity/sweep.sh --tier1` shows **8/8 PASS**. Update README coverage table. Tag `v0.1.0-tier1`.

---

## Phase 5 — Bulk Parity Sweep (parallelizable)

### Task 5.1–5.5: Sweep namespaces with the Phase-4 template

Order (highest yield first): **5.1 synth (29)** → **5.2 filter (90)** → **5.3 mixer (14)** → **5.4 classicNoisedeck (20)** → **5.5 render/points/synth3d/filter3d (29, hardest)**.

For each namespace:
- [ ] **Step 1:** Ensure a `parity/programs/<name>.dsl` exists for each effect (most already copied from sibling; author missing ones minimally: `search <ns>\n<name>().render(o0)`).
- [ ] **Step 2:** Run `bash parity/sweep.sh --namespace <ns>` (renders + compares every effect, tallies). This is parallelizable: dispatch one worker per effect (subagent-driven-development) since each is independent.
- [ ] **Step 3:** For each FAIL, apply the Task 4.1 debugging template. For genuine cross-device solver divergence (e.g. `reactionDiffusion`), add a documented tolerance relaxation or skip in `parity/sweep.sh` with a one-line rationale (match sibling decisions; verify seed-frame bit-exactness first).
- [ ] **Step 4:** After each namespace, update the README coverage table (`<ported>/<total>`, list skips). Commit.

- [ ] **Phase 5.5 prerequisites:** implement `createTexture3D` (Data3DTexture / layered RT) and `createCubeTexture` (WebGLCubeRenderTarget) + mesh upload (`uploadMeshData`) before the 3D/points namespace.

- [ ] **MILESTONE:** coverage table complete; every effect is PASS or documented-divergence with rationale.

---

## Phase 6 — Integration Surface + Docs

### Task 6.1: NoisemakerTexture
- [ ] Implement `class NoisemakerTexture` — `constructor(renderer, dsl, {width,height})`, `.texture` getter (the render-surface RT's `.texture`), `.update(dt)` advances one frame. Shares the caller's renderer; renders to its own targets (never the screen).
- [ ] Example `examples/texture-on-mesh.html`: map a noisemaker DSL onto a rotating cube.
- [ ] Test: render two frames headless, assert `.texture` is a non-null `THREE.Texture` and pixels change. Commit.

### Task 6.2: NoisemakerPass (EffectComposer)
- **DESIGN NOTE (2026-06-20):** the filter *logic* is already parity-verified (the 86-pass set
  includes many `noise().<filter>()` chains), so the Pass's only new concern is **binding the
  composer's `readBuffer` (a GPU RT) as the chain input.** External textures normally bind via
  `updateTextureFromSource(id, domSource)` (DOM only) — a Pass needs a GPU-texture path. The DSL
  would be `read(s0).<filter>().render(o0)` with `s0` bound to `readBuffer.texture`. But the
  pipeline's `createSurfaces` (pipeline.js:547) only auto-allocates `o0..o7` + globals referenced
  in passes — source-surface (`s0`) external binding is NOT a turnkey path; trace the expander's
  `kind:'source'` handling and add a `ThreeBackend.bindExternalSurface(name, threeTexture)`.
  Verification: self-consistency — render `noise().write(o0)` to a texture, feed it to a Pass
  running `read(s0).blur()`, compare to the canvas `noise().blur()` golden (already passing).
- [ ] Implement `class NoisemakerPass extends Pass` — `setSize`, `render(renderer, writeBuffer, readBuffer)` feeding `readBuffer.texture` as the chain input (`s0`) and outputting to `writeBuffer`. Respect `renderToScreen`.
- [ ] Example `examples/composer-pass.html`: a three.js scene with a noisemaker post chain.
- [ ] Test: insert into a minimal `EffectComposer`, render headless, assert output differs from input. Commit.

### Task 6.3: Types, build, docs
- [ ] Hand-author `types/index.d.ts` for the public API (`NoisemakerCanvas`, `NoisemakerTexture`, `NoisemakerPass`, `compileGraph`).
- [ ] `tools/build.mjs` (esbuild) → `dist/noisemaker-for-threejs.esm.js` + min; mark `three` external.
- [ ] Write `README.md` (quickstart for each façade + coverage table) and `ARCHITECTURE.md` (the layering + seam, the vendor/provenance model, the parity model). Commit.

---

## Self-Review

**Spec coverage:** §3 architecture → Tasks 2.x/3.x; §4 parity-critical → Global Constraints + Gates A/B + Task 2.2 steps 4–5; §5 vendoring → Task 0.2 (+ closure caveat); §6 integration → Phase 6; §7 harness → Task 0.4/1.1/2.3; §8 format/build → Task 0.1/6.3; §9 phases → Phases 0–6; §10 risks R1 (call surface enumerated in Task 2.2 interfaces), R2 (Global Constraints + begin/endFrame), R3 (Task 3.4), R4 (Task 0.2 integrity test), R5 (Task 0.3 loader). All covered.

**Placeholder scan:** No "TBD/handle edge cases". The per-effect work in Phases 4–5 is a complete, runnable template (DRY across 182 effects), not a placeholder. Stubbed backend methods (`createTexture3D` etc.) are explicitly scheduled (Task 3.5/5.5) with their implementation noted, not left vague.

**Type consistency:** `ThreeBackend`, `createThreePipeline`, `TextureStore`, `formatToType`, `fullscreenTriangle`, `registerEffects`, `NoisemakerCanvas/Texture/Pass` used consistently across tasks. Backend method names match the enumerated `pipeline.js` call surface.
