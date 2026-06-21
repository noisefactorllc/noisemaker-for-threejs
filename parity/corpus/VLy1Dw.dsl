search synth, filter, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sawInv, speed: 2, offset: -0.72)
let osc2 = osc(type: oscKind.sine)
let osc3 = osc(type: oscKind.noise)
let osc4 = osc(type: oscKind.noise, seed: 6469)
let osc5 = osc(type: oscKind.noise, min: 0.24, max: 0.81, speed: 6, seed: 4673)
let osc6 = osc(type: oscKind.noise, min: 0.54, speed: 3, seed: 8436)
let osc7 = osc(type: oscKind.sine, max: 0.1, speed: 20)

perlin(
  scale: 39.2,
  ridges: true,
  seed: 37
)
  .kaleido(
    sides: 7,
    loopScale: 52.32,
    speed: 50.17,
    kernel: shadow,
    effectWidth: 10
  )
  .adjust(
    mode: hsv,
    rotation: osc1,
    hueRange: 200,
    saturation: 0.75,
    contrast: 0.59
  )
  .tetraColorArray(
    colorMode: oklch,
    colorCount: 3,
    color0: #6bb7baff,
    color1: #130926ff,
    color2: #5f97a9ff,
    color3: #b37ac4ff,
    color4: #c19d59ff,
    color5: #898e48ff,
    color6: #e230fdff,
    color7: #6185f9ff,
    rotation: fwd,
    repeat: 0,
    offset: 0.49,
    alpha: 0.42,
    smoothness: 0.839
  )
  .coalesce(
    tex: read(o1),
    blendMode: reflect,
    mix: -32.55,
    refractAAmt: 24,
    refractBAmt: osc7,
    refractADir: osc2
  )
  .lighting(
    normalStrength: 5,
    smoothing: 2.5,
    specularIntensity: 0.55,
    shininess: 116,
    lightDirection: vec3(0.689, 0.378, 0.619),
    reflection: 49.7,
    refraction: 22,
    aberration: 35.1
  )
  .subchain(name: "lens effects", id: "e76d") {
    .chromaticAberration(aberration: 16.67, passthru: 55.49)
    .bloom(
      threshold: 0.35,
      softKnee: 0.26,
      intensity: 1.25,
      radius: 49,
      taps: 30
    )
    .lens(displacement: -0.47)
    .vignette()
  }
  .write(o0)

shapes3d(
  shapeA: octahedron,
  shapeAScale: osc6,
  shapeBScale: osc5,
  smoothness: 43.98,
  spin: osc3,
  spinSpeed: 0,
  flip: osc4,
  flipSpeed: 0,
  bgColor: #000000ff
)
  .write(o1)

render(o0)