search synth, filter, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sawInv)

perlin(
  scale: 43.62,
  ridges: true,
  seed: 37
)
  .kaleido(
    sides: 6,
    metric: hexagon,
    loopOffset: hexagon,
    loopScale: 58.2,
    speed: 50.17,
    kernel: shadow,
    effectWidth: 10
  )
  .blendMode(tex: read(o1), mode: multiply)
  .adjust(
    mode: hsv,
    rotation: osc1,
    hueRange: 51.43,
    saturation: 0.75,
    contrast: 0.59
  )
  .lighting(
    normalStrength: 5,
    smoothing: 2.5,
    lightDirection: vec3(0.689, 0.378, 0.619),
    reflection: 13.3,
    refraction: 38.2,
    aberration: 15.9
  )
  .subchain(name: "lens effects", id: "e76d") {
    .chromaticAberration(aberration: 16.67, passthru: 55.49)
    .bloom(
      threshold: 0.5,
      softKnee: 0.35,
      intensity: 1.7,
      radius: 49,
      taps: 30
    )
    .lens(displacement: -0.79)
    .vignette()
  }
  .write(o0)

polygon(
  sides: 6,
  radius: 0.8,
  smooth: 0.39
)
  .write(o1)

render(o0)