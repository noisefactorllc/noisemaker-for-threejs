# Noisemaker for Three.js — Design Spec

**Date:** 2026-06-20
**Status:** Approved (user delegated decisions: "proceed autonomously")
**Author:** port of the noisemaker shader platform to three.js

---

## 1. Context & Motivation

`noisemaker` is a browser-based procedural-shader platform (an EXTERNAL reference repo, located at
build time via `NM_REFERENCE_ROOT` — never a fixed relative path): a live-coding **DSL** compiles to
a render graph that runs on **WebGL2 (GLSL)** and **WebGPU (WGSL)** backends. Ports to other engines
already exist.

This spec defines **Noisemaker for Three.js** (`noisemaker-for-threejs`): a port targeting **three.js**.

### What makes this port fundamentally different from its siblings

The Godot/TD/Unity ports each crossed a **language boundary** (JS → GDScript / Python / C# / HLSL).
That forced them to: serialize `compileGraph(dsl)` to a **Render Graph JSON**, **re-implement the
executor** in the target language, and **re-port every shader**. The DSL "live compiler" was a
deferred Phase 6 in all three because re-implementing lexer→parser→validator→expander in another
language is expensive.

**three.js is JavaScript — the same language as the reference.** Therefore:

- The **entire compiler** (`lang/` lexer→parser→validator + `runtime/expander.js` + `resources.js`
  + `compiler.js`) is **pure, platform-agnostic JS** and is **reused verbatim**.
- The **executor** `runtime/pipeline.js` is coupled **only** to the abstract `Backend` interface
  (`runtime/backend.js`) — its constructor is literally `constructor(graph, backend)`. It is
  **reused verbatim** with a custom backend injected.
- All **182 effects' GLSL** is `#version 300 es` and runs **directly** in three.js via
  `RawShaderMaterial` + `glslVersion: THREE.GLSL3`. No shader re-porting.

The net result: the 182 effects are not 182 units of *porting* work — they are 182 units of
*parity verification* that pass for free **if and only if** the new backend is faithful. The real
engineering is **one backend class**.

### Why port to three.js at all (the value-add)

The reference is a standalone full-screen canvas renderer owning a raw WebGL2 context.
Noisemaker for Three.js makes Noisemaker a **first-class three.js citizen**:

1. **`NoisemakerTexture`** — run a DSL program into an offscreen render target exposed as a
   `THREE.Texture`, usable on any material / as a scene background / environment map source.
2. **`NoisemakerPass`** — an `EffectComposer` post-processing pass: feed the composer's read buffer
   in as `inputTex`, output the processed result. noisemaker becomes a post chain in any three.js app.
3. **`NoisemakerCanvas`** — a standalone full-screen renderer (parity-equivalent to the reference
   `CanvasRenderer`, but three.js-backed). Primary parity vehicle and simplest entry point.

All three share one core (reused `Pipeline` + new `ThreeBackend`); they differ only in I/O wiring.

---

## 2. Goals / Non-Goals

### Goals (v1)
- Pixel-parity with the reference **WebGL2/GLSL** path (same criterion as siblings).
- **Full live DSL** support from day one (free — the compiler is reused).
- All 182 effects reachable; parity-verified in tiers, divergences documented.
- A clean three.js integration surface (`NoisemakerCanvas`, `NoisemakerTexture`, `NoisemakerPass`).
- Self-contained, publishable as an npm package (`noisemaker-for-threejs`).

### Non-Goals (v1)
- **WGSL / WebGPU / three.js `WebGPURenderer` / TSL.** The reference already has a WebGPU backend;
  duplicating it here is wasted effort. Parity is defined against WebGL2. WebGPU is a noted future.
- **No modification of the reference core.** Vendored modules are byte-faithful to upstream (minus
  the backends we don't use). Honors the standing rule: *DSL/core changes are strictly additive;
  never restructure existing dispatch or canonical output.*
- No new effects, no new DSL syntax. This is a renderer/backend port, not a language project.

---

## 3. Architecture

### Layering

```
┌─────────────────────────────────────────────────────────────┐
│ Integration surface (NEW)                                     │
│   NoisemakerCanvas · NoisemakerTexture · NoisemakerPass       │
│   — owns a THREE.WebGLRenderer, wires I/O, drives the loop    │
├─────────────────────────────────────────────────────────────┤
│ ThreeBackend extends Backend (NEW — the only real work)       │
│   implements the ~20-method backend contract on three.js:     │
│   WebGLRenderTarget · RawShaderMaterial(GLSL3) · fullscreen   │
│   triangle · Points/billboards · MRT · Data3DTexture · blit   │
├─────────────────────────────────────────────────────────────┤
│ Reused reference core (VENDORED, never hand-edited)           │
│   lang/  (lex → parse → validate → unparse)                   │
│   runtime/ compiler.js (compileGraph) · expander.js ·         │
│            resources.js · pipeline.js (Pipeline) ·            │
│            registry.js · effect.js · backend.js (base) ·      │
│            tags.js · palettes.js · external-input.js ...      │
│   effect assets: definitions + GLSL + manifest                │
└─────────────────────────────────────────────────────────────┘
```

Data flow (identical to reference, by construction):

```
DSL source ──compileGraph()──▶ RenderGraph {passes, programs{fragment:GLSL}, textures, renderSurface}
                                      │
                                new Pipeline(graph, threeBackend)
                                      │  per frame: pipeline.render(t)
                                      ▼
   ThreeBackend.{beginFrame, executePass×N (ping-pong via pipeline), endFrame, present}
                                      ▼
                          THREE.WebGLRenderer → target / texture / screen
```

### The seam: `Backend` contract → three.js mapping

`ThreeBackend` mirrors the **full public surface of `runtime/backends/webgl2.js`** (the abstract
base lists the core; the concrete backend adds `present`, mesh/data uploads, cube). Mapping:

| Backend method | three.js implementation |
|---|---|
| `createTexture(id, spec)` | `new THREE.WebGLRenderTarget(w, h, {type: HalfFloat for rgba16f / UnsignedByte for rgba8, format: RGBA, depthBuffer: per-pass})`; **double-buffer** (two RTs) for ping-pong surfaces |
| `createTexture3D(id, spec)` | `THREE.Data3DTexture` / `WebGL3DRenderTarget` (layered) — for synth3d/filter3d |
| `createCubeTexture(id, {size})` | `THREE.WebGLCubeRenderTarget` |
| `compileProgram(id, spec)` | `new THREE.RawShaderMaterial({glslVersion: GLSL3, vertexShader, fragmentShader, uniforms})`; inject `#define`s by string-prepend (matches webgl2 `injectDefines`) |
| `executePass(pass, state)` | set material uniforms from `pass.uniforms`+`state.globalUniforms`; bind input textures; `renderer.setRenderTarget(out)`; draw fullscreen-tri mesh / Points / billboards / MRT |
| `copyTexture / clearTexture` | blit material / `renderer.clear()` into target |
| `beginFrame/endFrame` | save/restore renderer state, autoClear off |
| `present(textureId)` | blit the render surface to `setRenderTarget(null)` (or, for Texture/Pass modes, expose the RT instead of presenting) |
| `uploadMeshData / uploadDataTexture / updateTextureFromSource` | `BufferAttribute`s / `DataTexture` / `Texture` from `<video>`/`<canvas>` |

**Ping-pong, repeat, oscillator/MIDI/audio resolution, surface read/write swapping, and pass
ordering all live in the reused `pipeline.js`** — `ThreeBackend` is stateless w.r.t. them; it only
executes one pass and manages texture handles.

---

## 4. Parity-Critical Details

These are the known three.js footguns; each is a parity-gate checkpoint.

- **Color management:** `renderer.outputColorSpace = THREE.LinearSRGBColorSpace` (or `NoColorSpace`
  on targets); **disable** all sRGB encoding. All render targets are **linear float** (`HalfFloatType`
  for `rgba16f`), never sRGB-encoded. The reference renders in linear; three.js's default sRGB output
  conversion would break parity. `renderer.autoClear = false`.
- **Y-origin:** reference WebGL2 raster is bottom-left; three.js render-to-target shares WebGL2
  orientation. Siblings (TD, Godot) confirmed **no per-effect flip** needed; the present/blit handles
  final orientation. **Verify at Phase 2 with `gradient`** (Y-sensitive). Only the final present to
  the default framebuffer may need orientation care.
- **GLSL version:** `glslVersion: THREE.GLSL3` makes `RawShaderMaterial` emit `#version 300 es` —
  exactly the reference dialect. Use `RawShaderMaterial` (not `ShaderMaterial`) to avoid three.js's
  automatic uniform/attribute/`#define` prelude injection that would diverge from the reference.
- **No three.js prelude:** reference shaders declare their own `precision`, `in`/`out`, uniforms.
  Feed them raw; replicate webgl2's `injectDefines` (prepend `#define`s after `#version`).
- **Float quantization on readback:** parity compare reads pixels and `Math.round(v*255)`; ensure
  readback path matches reference's `readPixels` (which is bottom-up → row-flip, see webgl2 line ~644).
- **No per-frame allocations** in `executePass` (reuse uniform objects, geometry, materials) — both a
  perf rule (reference CLAUDE.md) and a determinism aid.
- **Documented expected divergence:** continuous iterated solvers at stability limits cannot be
  bit-exact cross-device (e.g. `reactionDiffusion`); siblings skip/relax these. Discrete sims
  (`cellularAutomata`) stay bit-exact. Discontinuity effects (`newton`, `edge`, fractals) get relaxed
  per-effect tolerance. We inherit the siblings' tolerance table.

---

## 5. Reuse Mechanism (vendoring)

Noisemaker for Three.js vendors the reference modules so it is self-contained and publishable (no sibling
checkout required to build, test, or use it). **`tools/sync-upstream.mjs`** (run by a maintainer with
the external reference located via `--ref`/`NM_REFERENCE_ROOT`):

1. Copies the pure modules from `$NM_REFERENCE_ROOT/shaders/src/` into `src/vendor/noisemaker-core/`:
   `lang/**`, `runtime/{compiler,expander,resources,pipeline,registry,effect,backend,tags,
   palette-expansion,effect-validator,external-input,obj-parser,default-shaders}.js`, `palettes.js`.
   **Excludes** `runtime/backends/**` and `renderer/canvas.js` (we supply our own).
2. Copies effect assets: each `shaders/effects/{ns}/{name}/{definition.js, glsl/*.glsl}` into
   `assets/effects/`, plus generates a manifest (reuse `generate-shader-manifest.mjs`).
3. Records the upstream **git hash** in `src/vendor/UPSTREAM.json` for provenance.
4. A CI/check asserts the vendored files are byte-identical to upstream (no hand-edits) — enforces
   "never modify the core."

Rationale over direct relative import: publishability, portability, sibling-consistency, and a
reviewable provenance diff on each refresh. Rationale over the CDN bundle: the bundle hardwires the
WebGL2/WebGPU backends and isn't pluggable; we need source to inject `ThreeBackend`.

The reference `index.js` re-exports demo UI (`../../demo/...`); we do **not** vendor that — we import
specific submodules to avoid pulling DOM/UI deps.

---

## 6. Integration Surface (the value-add)

One core, three façades:

- **`NoisemakerCanvas(canvas, opts)`** — `.compile(dsl)`, `.start()/.stop()`, `.resize(w,h)`,
  `.setValue(step, param, val)`. Owns a `WebGLRenderer` bound to `canvas`. Mirrors the reference
  `CanvasRenderer` API so existing reference host code ports trivially. **Primary parity vehicle.**
- **`NoisemakerTexture(renderer, dsl, {width, height})`** — `.texture` (a `THREE.Texture`/RT),
  `.update(dt)` to advance one frame. Drop onto `material.map`, `scene.background`, etc. Shares the
  caller's `WebGLRenderer`.
- **`NoisemakerPass(dsl, opts)`** — extends `Pass` (postprocessing). `inputTex` ← composer read
  buffer; output ← write buffer. Enables noisemaker in any `EffectComposer` chain.

Ship order: `NoisemakerCanvas` (Phases 2–5, the parity workhorse) → `NoisemakerTexture` →
`NoisemakerPass` (Phase 6). Core is architected for all three from the start.

---

## 7. Parity Harness (reused from siblings)

Reuse the siblings' language-agnostic harness verbatim:

- **Golden:** `tools/export-graph.mjs` runs the **unchanged reference** `compileGraph(dsl)`;
  `parity/export-and-render.mjs` renders the golden PNG via the reference headless WebGL2 (Chromium).
- **Candidate:** Noisemaker for Three.js (headless, via the same Chromium/Playwright path) renders the same
  DSL through `ThreeBackend` to a PNG.
- **Compare:** `parity/compare.py` — **max-abs-diff ≤ 2/255 AND SSIM ≥ 0.98** (default tolerance
  `2.001`); per-effect relaxations table from siblings (`newton`:255, `edge`:8, …); SSIM floor 0.98.
- **Tier-1 gate:** the 8 canonical effects (`solid`, `noise`, `cell`, `gradient`, `shape`, `osc2d`,
  `blur` [multi-pass], `blendMode` [two-input]) must **all PASS** before bulk coverage.
- **Sweep:** `parity/sweep.sh` runs all effects, tallies pass/fail, updates a coverage table.

Note: because Noisemaker for Three.js runs the **same compiler** as the golden generator, the *graph* is
identical by construction — the harness is purely validating the **backend's rendering fidelity**,
not the compiler. This is a stronger guarantee than the siblings get.

---

## 8. Module Format, Build, Package Layout

- **Vanilla JS ESM** for all new code (matches reference; reference CLAUDE.md: "production JS is
  vanilla browser-only"; "ONE WAY ONLY"). The vendored core is JS ESM; mixing TS at the backend seam
  adds friction without safety against untyped core.
- Ship hand-authored/generated **`.d.ts`** for the public integration API so consumers get types.
- **`three`** as a peer dependency (consumers bring their own three). Pin a known-good version;
  verify `GLSL3`, `WebGLRenderTarget {count}` (MRT), `Data3DTexture`, `WebGLCubeRenderTarget` exist in
  the installed version at Phase 0.
- Build with **esbuild** (same as reference) → ESM bundle + minified; per-effect lazy chunks optional.

```
noisemaker-for-threejs/
├─ package.json            (type:module, peer dep three, esbuild scripts)
├─ README.md  ARCHITECTURE.md
├─ docs/superpowers/specs/2026-06-20-noisemaker-for-threejs-design.md   (this file)
├─ docs/IMPLEMENTATION-PLAN.md
├─ src/
│  ├─ index.js                       (public exports)
│  ├─ backend/three-backend.js       (ThreeBackend — the work)
│  ├─ backend/three-resources.js     (RT pool, material cache, geometry)
│  ├─ integration/{canvas,texture,pass}.js
│  ├─ effects/loader.js              (registers vendored effects)
│  └─ vendor/noisemaker-core/**      (synced, never edited) + UPSTREAM.json
├─ assets/effects/**                 (synced definitions + glsl + manifest)
├─ tools/{sync-upstream,export-graph}.mjs
├─ parity/{compare.py, programs/*.dsl, export-and-render.mjs, run.sh, sweep.sh, out/}
└─ test/                             (unit + integration)
```

---

## 9. Phase Plan

DSL is free (reused), so there is **no "Phase 6 live compiler"** — it works from Phase 2.

- **Phase 0 — Scaffold & vendor.** Project skeleton, `package.json`, `npm i three`, verify three.js
  capabilities, write `sync-upstream.mjs`, vendor core + effects, copy parity harness from siblings,
  verify `export-graph.mjs` produces a graph and `compileGraph` runs in-repo. README/ARCHITECTURE.
- **Phase 1 — Golden assets.** Generate Tier-1 graph JSONs + golden PNGs (256²) via the reference.
- **Phase 2 — ThreeBackend MVP + first parity.** Minimal `ThreeBackend` (createTexture,
  compileProgram, single-output executePass, present) + `NoisemakerCanvas` + headless candidate
  render. **Gate: `solid` PASS, then `gradient` (confirms Y-origin).**
- **Phase 3 — Full backend.** Multi-pass intermediates, RT pool + liveness, ping-pong surfaces (drive
  via reused pipeline), blend, repeat, MRT, `copyTexture`/blit, uniform binding for all types,
  per-subsystem gates (`blur` for multi-pass, `blendMode` for two-input).
- **Phase 4 — Tier-1 → parity.** All 8 canonical effects PASS. **Critical milestone.**
- **Phase 5 — Bulk parity sweep.** synth → filter → mixer → classicNoisedeck → points/3D. Per-effect
  tolerance table; document divergences/skips. Coverage table in README.
- **Phase 6 — Integration surface + docs.** `NoisemakerTexture`, `NoisemakerPass`, examples (effect
  on a 3D mesh; noisemaker as an EffectComposer pass), `.d.ts`, build, publish prep.

---

## 10. Risks & Open Questions

- **R1 — `pipeline.js`/`canvas.js` call methods beyond the abstract base.** Mitigation: at Phase 2,
  grep `this.backend.` across `pipeline.js` and any reused orchestration to enumerate the exact call
  surface; implement the full superset. (Known extras: `present`, mesh/data uploads, cube.)
- **R2 — three.js renderer state bleed** (color mgmt, autoClear, scissor, viewport) breaking parity.
  Mitigation: explicit state save/restore in begin/endFrame; linear/NoColorSpace; the parity gates
  catch regressions immediately.
- **R3 — MRT / `drawMode:"points"` / 3D / compute-as-GPGPU** edge cases. Mitigation: mirror webgl2.js
  exactly (it already converts compute→render); use modern three.js MRT (`WebGLRenderTarget {count}`).
- **R4 — Vendored core drift / accidental edits.** Mitigation: byte-identity check + `UPSTREAM.json`.
- **R5 — Effect asset loading** (definition.js imports + GLSL inlining). Mitigation: reuse
  `registry.js`/`effect.js`; build a manifest at sync time; load lazily by id.
- **Q1 — TS vs JS for public API.** Decided JS+`.d.ts`; revisit if consumers demand full TS.
- **Q2 — three.js version pin.** Resolve at Phase 0 against the actually-installed version.

---

## 11. Testing & Verification

- Unit: backend resource mgmt (RT pool, material cache, ping-pong swap correctness).
- Integration: `compileGraph(dsl)` → `Pipeline` + `ThreeBackend` → headless render → PNG.
- Parity: the harness above; **no effect is "done" until `compare.py` exits 0** with shown output
  (verification-before-completion: evidence before assertions).
- Lint: eslint (reuse reference config style).

---

## 12. Provenance / housekeeping

- Greenfield, self-contained `noisemaker-for-threejs` (no dependency on any sibling checkout). Git initialized.
- **No Claude attribution** on commits (per standing user preferences).
