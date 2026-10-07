import { test } from 'node:test'
import assert from 'node:assert'
import * as THREE from 'three'
import {
  formatToType,
  fullscreenTriangle,
  stripVersion,
  parseUniformSizes,
  DEFAULT_VERTEX_SHADER,
} from '../src/backend/three-resources.js'

test('formatToType maps noisemaker formats to three.js types', () => {
  assert.equal(formatToType('rgba16f'), THREE.HalfFloatType)
  assert.equal(formatToType('rgba32f'), THREE.FloatType)
  assert.equal(formatToType('r16f'), THREE.HalfFloatType)
  assert.equal(formatToType('r32f'), THREE.FloatType)
  // The reference resolves the WebGPU spellings since engine 1.0.262 (bloom declares
  // rgba16float, buddhabrot rgba32float); unknown and absent formats stay rgba8.
  assert.equal(formatToType('rgba8unorm'), THREE.UnsignedByteType)
  assert.equal(formatToType('rgba16float'), THREE.HalfFloatType)
  assert.equal(formatToType('rgba32float'), THREE.FloatType)
  assert.equal(formatToType('r16float'), THREE.HalfFloatType)
  assert.equal(formatToType('r32float'), THREE.FloatType)
  assert.equal(formatToType('bgra8'), THREE.UnsignedByteType)
  assert.equal(formatToType(undefined), THREE.UnsignedByteType)
})

test('fullscreenTriangle has 3 verts on position', () => {
  const g = fullscreenTriangle()
  const attr = g.getAttribute('position')
  assert.equal(attr.count, 3)
  assert.equal(attr.itemSize, 2)
})

test('stripVersion removes a leading #version line only', () => {
  const src = '#version 300 es\nprecision highp float;\nvoid main(){}'
  assert.equal(stripVersion(src), 'precision highp float;\nvoid main(){}')
  // No #version -> unchanged.
  assert.equal(stripVersion('void main(){}'), 'void main(){}')
})

test('DEFAULT_VERTEX_SHADER carries no #version line (three.js adds it)', () => {
  assert.ok(!DEFAULT_VERTEX_SHADER.includes('#version'))
  assert.ok(DEFAULT_VERTEX_SHADER.includes('position'))
  assert.ok(DEFAULT_VERTEX_SHADER.includes('v_texCoord'))
})

test('parseUniformSizes reads scalar/vector uniforms and skips arrays', () => {
  const src = 'uniform float a;\nuniform highp vec3 b ;\nuniform vec4 c [ 2 ] ;\nuniform mediump vec2 d [3];\nuniform sampler2D t;'
  assert.deepEqual(parseUniformSizes(src), { a: 1, b: 3 })
})

test('parseUniformSizes stays linear on long whitespace runs (js/polynomial-redos)', () => {
  const start = process.hrtime.bigint()
  parseUniformSizes('uniform float a' + ' '.repeat(200000) + 'x')
  parseUniformSizes('uniform float a' + ' '.repeat(200000) + '[3]' + ' '.repeat(200000) + 'x')
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  assert.ok(ms < 1000, `whitespace run took ${ms}ms`)
})
