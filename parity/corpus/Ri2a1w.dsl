search synth, filter, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sawInv, speed: 2, offset: -0.72)
let osc2 = osc(type: oscKind.sine)

perlin(
  scale: 23.03,
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
    color0: #6bb7ba,
    color1: #130926,
    color2: #5f97a9,
    color3: #b37ac4,
    color4: #c19d59,
    color5: #898e48,
    color6: #e230fd,
    color7: #6185f9,
    rotation: fwd,
    repeat: 0,
    offset: 0.49,
    alpha: 0.42,
    smoothness: 0.839
  )
  .coalesce(
    tex: read(o1),
    blendMode: multiply,
    refractAAmt: 4.29,
    refractADir: osc2
  )
  .lighting(
    normalStrength: 5,
    smoothing: 2.2,
    specularIntensity: 0.55,
    shininess: 116,
    lightDirection: vec3(0.689, 0.378, 0.619),
    reflection: 49.7,
    refraction: 18.3,
    aberration: 15.9
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

polygon(
  sides: 7,
  radius: 0.79,
  smooth: 0.18,
  rotation: -88.99
)
  .write(o1)

render(o0)