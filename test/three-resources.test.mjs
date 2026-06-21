import { test } from 'node:test'
import assert from 'node:assert'
import * as THREE from 'three'
import {
  formatToType,
  fullscreenTriangle,
  stripVersion,
  DEFAULT_VERTEX_SHADER,
} from '../src/backend/three-resources.js'

test('formatToType maps noisemaker formats to three.js types', () => {
  assert.equal(formatToType('rgba16f'), THREE.HalfFloatType)
  assert.equal(formatToType('rgba8unorm'), THREE.UnsignedByteType)
  assert.equal(formatToType('rgba32f'), THREE.FloatType)
  assert.equal(formatToType(undefined), THREE.HalfFloatType) // default
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
