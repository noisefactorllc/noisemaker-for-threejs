import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { chromiumLaunchArgs } from '../parity/launch-args.mjs'
import { startLoopbackServer } from '../parity/loopback-server.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const mime = { '.js': 'text/javascript', '.json': 'application/json' }
const fill = `#version 300 es
precision highp float;
out vec4 outputBuffer;
void main() { outputBuffer = vec4(1.0, 0.5, 0.25, 1.0); }`
const copy = `#version 300 es
precision highp float;
uniform sampler2D workTex;
out vec4 fragColor;
void main() { fragColor = texelFetch(workTex, ivec2(gl_FragCoord.xy), 0); }`

function definition(func, target, emptyOutputs = false) {
  const named = target === 'work'
  return {
    namespace: 'user', name: func, func, globals: {},
    ...(named ? { textures: { work: { width: '100%', height: '100%', format: 'rgba8unorm' } } } : {}),
    shaders: { fill: { glsl: fill }, copy: { glsl: copy } },
    passes: [
      { name: 'fill', type: 'compute', program: 'fill', storageTextures: { outputBuffer: target },
        ...(emptyOutputs ? { outputs: {} } : {}) },
      ...(named ? [{ name: 'copy', program: 'copy', inputs: { workTex: 'work' }, outputs: { fragColor: 'outputTex' } }] : []),
    ],
  }
}

const copyFilter = {
  namespace: 'user', name: 'storageCopyFilter', func: 'storageCopyFilter', globals: {},
  shaders: { copy: { glsl: copy } },
  passes: [{ name: 'copy', program: 'copy', inputs: { workTex: 'inputTex' }, outputs: { fragColor: 'outputTex' } }],
}
const cases = [
  ['direct', ['storageDirect()'], [definition('storageDirect', 'outputTex')]],
  ['named', ['storageNamed()'], [definition('storageNamed', 'work')]],
  ['empty outputs', ['storageEmpty()'], [definition('storageEmpty', 'work', true)]],
  ['intermediate', ['storageDirect().storageCopyFilter()'], [definition('storageDirect', 'outputTex'), copyFilter]],
  ['recompile', ['solid().storageCopyFilter()', 'storageDirect().storageCopyFilter()'],
    [definition('storageDirect', 'outputTex'), copyFilter]],
]

async function serve(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname === '/storage-targets') {
    response.setHeader('Content-Type', 'text/html')
    response.end('<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><canvas width="32" height="32"></canvas>')
    return
  }
  const path = resolve(root, '.' + pathname)
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !(await stat(path).catch(() => null))?.isFile()) {
    response.writeHead(404).end()
    return
  }
  response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream')
  createReadStream(path).pipe(response)
}

test('storage-only passes render their declared targets through the reference and Three.js', { timeout: 90000 }, async t => {
  const { server, port } = await startLoopbackServer(() => createServer((req, res) => {
    serve(req, res).catch(error => res.destroy(error))
  }))
  let browser
  try {
    browser = await chromium.launch({ headless: true, args: chromiumLaunchArgs(), timeout: 30000 })
    for (const backend of ['webgl2', 'three']) {
      for (const [name, calls, definitions] of cases) {
        await t.test(`${backend}: ${name}`, async () => {
          const page = await browser.newPage()
          const diagnostics = []
          page.on('pageerror', error => diagnostics.push(error.message))
          page.on('console', message => {
            if (['warning', 'error'].includes(message.type())) diagnostics.push(message.text())
          })
          try {
            await page.goto(`http://127.0.0.1:${port}/storage-targets`)
            const pixels = await page.evaluate(async ({ backend, calls, definitions }) => {
              const Renderer = backend === 'three'
                ? (await import('/src/integration/canvas.js')).NoisemakerCanvas
                : (await import('/vendor/noisemaker/noisemaker-shaders-reference.esm.js')).CanvasRenderer
              const canvas = document.querySelector('canvas')
              const renderer = backend === 'three'
                ? new Renderer(canvas, { width: 32, height: 32 })
                : new Renderer({ canvas, width: 32, height: 32, basePath: '/vendor/noisemaker',
                  useBundles: true, bundlePath: '/vendor/noisemaker/effects', preferWebGPU: false })
              try {
                if (backend === 'webgl2') {
                  await renderer.loadManifest()
                  await renderer.loadEffects(['synth/solid'])
                }
                for (const definition of definitions) await renderer.registerPortableEffect(definition)
                for (const call of calls) {
                  await renderer.compile(`search user, synth\n${call}.write(o0)\nrender(o0)`)
                  if (backend === 'three') {
                    renderer.renderFrame(0)
                    renderer.renderFrame(0)
                  } else {
                    await renderer.render(0)
                    await renderer.render(0)
                  }
                }
                const gl = canvas.getContext('webgl2')
                const bytes = new Uint8Array(32 * 32 * 4)
                gl.readPixels(0, 0, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
                return Array.from(bytes)
              } finally {
                await renderer.dispose()
              }
            }, { backend, calls, definitions })
            assert.deepEqual(diagnostics, [])
            assert.equal(pixels.length, 32 * 32 * 4)
            for (let i = 0; i < pixels.length; i++) {
              assert.ok(Math.abs(pixels[i] - [255, 128, 64, 255][i % 4]) <= 1, `channel ${i}: ${pixels[i]}`)
            }
          } finally {
            await page.close()
          }
        })
      }
    }
  } finally {
    await browser?.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }
})
