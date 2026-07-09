# noisemaker-three

> Run **Noisemaker**'s procedural visuals in **three.js**.

## What is this?

**Noisemaker** is a procedural visual engine. You write tiny text programs — chains of effects — and
it renders live, animated GPU textures:

```
search synth, filter
noise(scaleX: 60).bloom().write(o0)
render(o0)
```

That little language is Noisemaker's **DSL** (a domain-specific language for visuals). The original
engine runs in the browser at [noisedeck.app](https://noisedeck.app).

**noisemaker-three** runs that same engine in **three.js**, so you can use Noisemaker's ~185 effects
as live textures, materials, and backgrounds in any three.js scene.

This is a **thin adapter, not a port** — about 2,900 lines of new code wrapped around the
**unmodified** Noisemaker engine. The engine already runs on JavaScript and WebGL2, which is exactly
what three.js uses, so the DSL compiler, the effects, and their shaders are reused as-is. The only
real new code is one small piece — a `ThreeBackend` — that lets the engine draw through three.js.

The engine itself is **never committed here**. It's fetched from the Noisemaker CDN
([shaders.noisedeck.app](https://shaders.noisedeck.app)) into a git-ignored `vendor/` folder — the
same way `node_modules` works.

## What you can do with it

- **Generate animated textures** from a short program — noise, gradients, patterns, color grades,
  blurs, warps.
- **Run simulations on the GPU** — particle/agent systems (flocking, slime/physarum, diffusion) and
  fluid (navier–stokes).
- **Use the result anywhere a texture goes** — materials, scene backgrounds, sprites — via a
  `NoisemakerTexture`.
- **Post-process your scene** — drop a `NoisemakerPass` into an `EffectComposer` chain.
- **Render full-screen** — a `NoisemakerCanvas` for standalone visuals.

## Requirements

- **three.js ≥ 0.160** — a peer dependency, so you install it alongside.
- A **WebGL2** context — any modern browser. (Noisemaker's effects are WebGL2 shaders.)
- **Node.js** — to install and to fetch the engine.

## Install

```bash
npm install        # three + tooling
npm run vendor     # fetch the Noisemaker engine from the CDN into vendor/ (git-ignored)
```

The `vendor` step is required once: it downloads the engine and effect bundles the adapter drives.
The engine bytes are never committed — only the fetch script is.

Then serve the repo root with any static server and open an example in your browser:

```bash
npx serve .        # or any static server, e.g. python3 -m http.server
```

Open `examples/texture-on-mesh.html` (or `examples/effect-composer-pass.html`) from the served
root. The examples are ES modules, so they must be served over HTTP — opening them via `file://`
will not work.

## Your first render

Serve the repo root (see Install above) and open an HTML page like this one. An import map tells the
browser where to find `three` (the adapter imports it by name); the adapter itself loads from
`/src/index.js`:

```html
<script type="importmap">
  { "imports": { "three": "/node_modules/three/build/three.module.js" } }
</script>
<canvas></canvas>
<script type="module">
  import { NoisemakerCanvas } from '/src/index.js'

  const nm = new NoisemakerCanvas(document.querySelector('canvas'), { width: 512, height: 512 })
  await nm.compile(`
    search synth, filter
    noise(seed: 1, scaleX: 50, scaleY: 50).bloom().write(o0)
    render(o0)
  `)

  function frame(t) {
    nm.renderFrame((t / 4000) % 1)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
</script>
```

**Every DSL program** has the same shape: name the namespaces it uses (`search synth, filter`),
chain effects, write the result to an output surface (`.write(o0)`), then pick one to show
(`render(o0)`).

## Use it in your own three.js project

A `NoisemakerTexture` runs a DSL program offscreen and hands you a normal `THREE.Texture`. It shares
your renderer, so you can drop it onto any material:

```js
import { NoisemakerTexture } from '/src/index.js'   // served from the repo root (see Install)

const nmTex = new NoisemakerTexture(renderer, { width: 512, height: 512 })
await nmTex.compile('search synth\nnoise(octaves: 4, speed: 1).write(o0)\nrender(o0)')
material.map = nmTex.texture                 // a stable texture — set it once

// in your render loop:
nmTex.update((performance.now() / 6000) % 1)
```

To post-process an existing scene instead, use a `NoisemakerPass` in an `EffectComposer` chain.
Runnable examples: [`examples/texture-on-mesh.html`](examples/texture-on-mesh.html) and
[`examples/effect-composer-pass.html`](examples/effect-composer-pass.html).

## What works today

- **Essentially the whole published catalog renders** (~185 effects: 2D, 3D, particle/agent sims,
  and fluid) and is **pixel-identical to the web reference** — it's the same shaders running on the
  same WebGL2 driver.
- **Particle/agent sims and fluid (navier–stokes)** match exactly, even frame-by-frame over long
  runs.
- **3D effects work** — volumetric raymarching and cubemaps included.
- **Drop-in three.js wrappers** — `NoisemakerCanvas`, `NoisemakerTexture`, and `NoisemakerPass`.
- The only gaps are effects that need a **live external feed** — audio, video, a loaded OBJ mesh, or
  text rendering. (They still render correctly when given a fixed test input.)

Full coverage table and parity numbers: **[STATUS.md](STATUS.md)**.

## How it works

Noisemaker compiles a DSL program into a **render graph** — a normalized list of GPU passes — and
runs it through a small `Pipeline`. The pipeline asks a **backend** to do the actual GPU work:
allocate render targets, compile shaders, draw passes.

Because three.js is JavaScript + WebGL2 — exactly what the reference engine already targets — none of
that needed re-implementing. This adapter supplies one new backend, `ThreeBackend`, that maps the
engine's GPU calls onto three.js primitives (`WebGLRenderTarget`, `RawShaderMaterial`, a fullscreen
triangle, double-buffered surfaces). Everything else — the compiler, the effects, the GLSL — is the
unmodified engine fetched from the CDN.

Design notes and the full build plan: [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md).

## Contributing

The adapter drives the fetched CDN engine, so `npm run vendor` is the only setup. Then:

```bash
npm test           # capability + three.js resource checks
npm run parity     # diff every corpus program (the live noisedeck gallery) against the reference engine
```

Parity works by running the **same** CDN engine two ways — once through its own WebGL2 backend (the
"golden") and once through `ThreeBackend` (the candidate) — and comparing the rendered frames. To
check a single effect, run the time-series harness directly — `node parity/timeseries.mjs
parity/programs/<effect>.dsl` — or run `parity/sweep-stateful.sh` for the stateful/continuous
effects (navier–stokes, reaction-diffusion, agents). Methodology and per-effect results:
**[STATUS.md](STATUS.md)**.

## Repo layout

```
src/         the adapter — public API, ThreeBackend, three.js wrappers
vendor/      fetch script + Node loader (the engine bytes are git-ignored)
parity/      parity harness, test programs, live corpus
examples/    runnable HTML examples
docs/        design spec + implementation plan
reference/   engine specs shared across all Noisemaker ports
STATUS.md    coverage table, parity results, known limits
```

## License

MIT (see [LICENSE](LICENSE)). Use of the Noisemaker and Noise Factor names in derivative products is
subject to the [Trademark Policy](TRADEMARK.md).

Copyright © 2026 Noise Factor LLC
