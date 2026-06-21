/**
 * three.js resource helpers for ThreeBackend.
 *
 * Pure/GL-light building blocks: texture-format mapping, the fullscreen-triangle
 * geometry, the default vertex shader, and #version stripping (three.js RawShaderMaterial
 * with glslVersion:GLSL3 re-adds `#version 300 es`, so source must not carry its own).
 */
import * as THREE from 'three'

/** Map a noisemaker texture format string to a three.js texture data type. */
export function formatToType(fmt) {
  switch (fmt) {
    case 'rgba8unorm':
    case 'rgba8':
      return THREE.UnsignedByteType
    case 'rgba32f':
      return THREE.FloatType
    case 'rgba16f':
    default:
      return THREE.HalfFloatType
  }
}

/**
 * Fullscreen triangle geometry with an `a_position` attribute, matching the
 * reference DEFAULT_VERTEX_SHADER (FULLSCREEN_TRIANGLE_POSITIONS).
 */
export function fullscreenTriangle() {
  const geo = new THREE.BufferGeometry()
  // Must be named `position`: three.js derives the draw vertex count from
  // geometry.attributes.position. (The VS reads `position` directly.)
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2)
  )
  // Set boundingSphere manually: auto-compute reads a 3rd component from our vec2
  // positions and warns "radius is NaN". A fixed sphere is fine (frustumCulled=false).
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2)
  return geo
}

/**
 * Default vertex shader (GLSL ES 3.00 body WITHOUT the `#version` line — three.js
 * prepends it for GLSL3). Mirrors the reference runtime/default-shaders.js DEFAULT_VERTEX_SHADER:
 * passes a 0..1 `v_texCoord` and positions a fullscreen triangle.
 */
export const DEFAULT_VERTEX_SHADER = `precision highp float;
in vec2 position;
out vec2 v_texCoord;

void main() {
    v_texCoord = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
`

/** Remove a leading `#version ...` line so three.js can supply its own for GLSL3. */
export function stripVersion(src) {
  return src.replace(/^[ \t]*#version[^\n]*\n/, '')
}
