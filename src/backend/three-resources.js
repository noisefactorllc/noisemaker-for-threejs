/**
 * three.js resource helpers for ThreeBackend.
 *
 * Pure/GL-light building blocks: texture-format mapping, the fullscreen-triangle
 * geometry, the default vertex shader, and #version stripping (three.js RawShaderMaterial
 * with glslVersion:GLSL3 re-adds `#version 300 es`, so source must not carry its own).
 */
import * as THREE from 'three'

/**
 * Map a noisemaker texture format string to a three.js texture data type — matching the
 * reference webgl2 resolveFormat EXACTLY. The reference recognizes ONLY rgba16f/rgba32f
 * (+rgba8); ALL other strings (rgba8unorm, rgba16float, rgba32float, undefined) fall back
 * to rgba8 = UnsignedByte. This is load-bearing: bloom declares "rgba16float" intermediates,
 * which the reference renders as RGBA8 — clamping HDR to [0,1]. Using HalfFloat instead
 * preserves HDR and diverges from the reference on HDR input (e.g. lighting → bloom).
 */
export function formatToType(fmt) {
  switch (fmt) {
    case 'rgba16f':
      return THREE.HalfFloatType
    case 'rgba32f':
      return THREE.FloatType
    default:
      return THREE.UnsignedByteType
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

/**
 * Remove the `#version ...` directive so three.js can supply its own for GLSL3.
 * GLSL guarantees `#version` is the first non-comment token, but some effects
 * (e.g. render/render3d) put a doc-comment block ahead of it, so the directive
 * is not on line 1. The `m` flag matches it at the start of any line; `.replace`
 * without `g` removes only the first (real) directive. Leaving the preceding
 * comment in place is harmless — comments are inert after three's prepend.
 */
export function stripVersion(src) {
  return src.replace(/^[ \t]*#version[^\n]*\r?\n/m, '')
}

// Component count per GLSL scalar/vector type — for coercing array uniform values to
// the exact length the uniform expects (see parseUniformSizes).
const GLSL_UNIFORM_COMPONENTS = {
  float: 1, int: 1, uint: 1, bool: 1,
  vec2: 2, vec3: 3, vec4: 4,
  ivec2: 2, ivec3: 3, ivec4: 4,
  uvec2: 2, uvec3: 3, uvec4: 4,
  bvec2: 2, bvec3: 3, bvec4: 4,
}

/**
 * Parse `uniform vecN <name>;` declarations from GLSL source into {name: components}.
 *
 * Load-bearing for color params: the graph resolves `type: color` to a 4-element RGBA
 * array `[r,g,b,1]`, but most color uniforms are `vec3`. `gl.uniform3fv` requires the
 * array length to be a multiple of 3, so a length-4 array raises INVALID_VALUE and the
 * uniform silently stays 0 (black) — the reference avoids this by copying into a fixed
 * vec3 buffer. We coerce array values to this declared length to match (see fitVec).
 *
 * Skips samplers (not in the map), array uniforms (`vec3 k[9]` — legitimately multi-),
 * and UBO block members (matched only at file scope by the leading `uniform`).
 */
export function parseUniformSizes(source) {
  const sizes = {}
  const re = /\buniform\s+(?:highp\s+|mediump\s+|lowp\s+)?(\w+)\s+(\w+)\s*(\[[^\]]*\])?\s*;/g
  let m
  while ((m = re.exec(source))) {
    const [, type, name, isArray] = m
    if (isArray) continue
    const c = GLSL_UNIFORM_COMPONENTS[type]
    if (c) sizes[name] = c
  }
  return sizes
}
