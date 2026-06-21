import { test } from 'node:test'
import assert from 'node:assert'
import * as THREE from 'three'

// Gate: the installed three.js must expose every primitive ThreeBackend relies on.
// If any of these fail, bump/re-pin three.js before proceeding.

test('three.js exposes GLSL3 (needed for #version 300 es via RawShaderMaterial)', () => {
  assert.ok(THREE.GLSL3)
})

test('three.js exposes Data3DTexture (synth3d/filter3d volumes)', () => {
  assert.equal(typeof THREE.Data3DTexture, 'function')
})

test('three.js exposes WebGLCubeRenderTarget (cubemap effects)', () => {
  assert.equal(typeof THREE.WebGLCubeRenderTarget, 'function')
})

test('WebGLRenderTarget supports MRT via {count} option', () => {
  const rt = new THREE.WebGLRenderTarget(2, 2, { count: 2 })
  assert.ok(Array.isArray(rt.textures) && rt.textures.length === 2,
    'expected rt.textures to be an array of length 2')
  rt.dispose()
})

test('three.js exposes HalfFloatType + UnsignedByteType (rgba16f / rgba8unorm)', () => {
  assert.equal(typeof THREE.HalfFloatType, 'number')
  assert.equal(typeof THREE.UnsignedByteType, 'number')
})

test('three.js exposes RawShaderMaterial', () => {
  assert.equal(typeof THREE.RawShaderMaterial, 'function')
})
