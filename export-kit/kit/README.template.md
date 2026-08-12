# {{NM_PROGRAM_NAME}}

Your program as a Three.js scene, exported from Noisedeck. It runs on **Noisemaker for Three.js** —
a thin adapter that hands the unmodified Noisemaker engine a `ThreeBackend`, so the effects, the
shaders and the compiler are the same ones the app uses. It fetches nothing at runtime.

## Run it

Browsers refuse ES modules over `file://`, so serve the folder. From this directory:

```
python3 -m http.server 8000
```

Open <http://localhost:8000/>. No backend, no build step, no npm.

## What's inside

| Path | What it is |
| --- | --- |
| `index.html` | The page. Your program is inlined at the top of its module script. |
| `adapter/src/` | Noisemaker for Three.js — `NoisemakerCanvas`, `NoisemakerTexture`, `NoisemakerPass`. |
| `adapter/vendor/noisemaker/` | The Noisemaker engine `{{NM_ENGINE_VERSION}}`. Present if you kept **include engine code** checked. |
| `hostlib/three/` | Three.js 0.171.0. Same checkbox. |
| `program.dsl` | Your program's source, exactly as Noisedeck had it. |
| `noisedeck-export.json` | What was exported, when, against which engine build. |
| `shaders/` | The GLSL behind each effect you used. Present if you kept **include shader code** checked. |
| `LICENSES/` | Licenses for everything shipped here. |

## Dropping it into your own scene

`index.html` uses `NoisemakerCanvas`, the standalone full-screen host. The adapter also exposes the
two surfaces you want inside an existing scene:

```js
import { NoisemakerTexture, NoisemakerPass } from './adapter/src/index.js'
```

- `NoisemakerTexture` — your program as a `THREE.Texture`, for any material, sprite or
  `scene.background`.
- `NoisemakerPass` — your program as an `EffectComposer` post-processing pass.

Both need the effects registered first. `index.html` does that in `registerEffects()`, and that
function is the piece to lift into your own app.

## The engine

Left **include engine code** checked? Everything's here: the engine at
`adapter/vendor/noisemaker/`, Three.js at `hostlib/three/`. Open the page and it runs offline.

Unchecked? Copy your engine to `adapter/vendor/noisemaker/` and Three.js to `hostlib/three/`, or
point the imports at your copies. The adapter reaches the engine through one static import in
`adapter/src/engine-browser.js`:

```js
import * as core from '../vendor/noisemaker/noisemaker-shaders-core.esm.js'
```

That path is fixed at the module level — there is no constructor option and no global — which is
why the engine has to sit beside `adapter/src/`. The page resolves `three` through its import map:

```html
<script type="importmap">
{ "imports": { "three": "./hostlib/three/three.module.min.js" } }
</script>
```

`hostlib/three/` holds two files: `three.module.min.js`, the entry above, and `three.core.min.js`,
which it imports. Keep them together.

Effect mini-bundles are loaded by the page rather than by the adapter. `registerEffects()` reads
`BUNDLE_PATH` — `./adapter/vendor/noisemaker/effects` — and registers through the adapter's own
`register-effect.js`, so registration can never drift from the adapter's internal loader.

Three.js is pinned to **0.171.0**, the version the adapter is parity-tested against. Its peer range
is `>=0.160.0`, so a newer build will very likely work; swap the files in `hostlib/three/`.

This export is pinned to Noisemaker `{{NM_ENGINE_VERSION}}`. Pinning is deliberate: the page keeps
rendering the same way after the engine moves on.

## Editing it

`index.html` holds your program as a string:

```js
const DSL = "...";
```

Replace it with anything the Noisemaker language accepts and reload. Only the effects your original
program used are under `adapter/vendor/noisemaker/effects/`, so a new effect will fail to load.
Stay within the set below, or add the bundles you need.

Playback loops every 15 seconds (`LOOP_SECONDS`). The canvas is measured once at load, capped at 2x
device pixel ratio.

`NoisemakerCanvas` has no live resize, so the render keeps the resolution it was measured at.
Resizing rescales that image rather than re-rendering: the page uses `object-fit: contain`, so it
letterboxes rather than stretches. **Reload to render at the new size** — that is the only way to
get full resolution back after growing the window.

If the program fails to start the page says so on screen and puts the full error in the console.

## Effects used by this program

{{NM_EFFECT_LIST}}

## Browser support

WebGL2 runs in every current desktop and mobile browser. Heavy programs, and anything using 3D or
particles, want a discrete GPU for a smooth frame rate.

## License

The Noisemaker engine and the Three.js adapter are both MIT licensed; see `LICENSES/`. Three.js
itself is MIT and ships in `hostlib/three/`. Your program and the imagery it renders are yours.
