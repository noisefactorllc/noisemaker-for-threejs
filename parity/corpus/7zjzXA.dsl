search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sawInv)

perlin(scale: 31.37, seed: 23)
  .seamless(blend: 0.13, repeat: 1)
  .adjust(
    rotation: osc1,
    hueRange: 200,
    saturation: 4,
    contrast: 1
  )
  .subchain(name: "flow field particles", id: "p0wu") {
    .pointsEmit(stateSize: x512, attrition: 10)
    .flow(
      behavior: unruly,
      stride: 25,
      strideDeviation: 0
    )
    .pointsRender(
      density: 100,
      intensity: 85.04,
      inputIntensity: 0
    )
  }
  .adjust(
    rotation: -42.42,
    hueRange: 23.22,
    saturation: 0.75,
    brightness: 0.54,
    contrast: 0.79
  )
  .subchain(name: "lens effects", id: "5nr0") {
    .chromaticAberration(aberration: 17.12, passthru: 57.78)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.13, alpha: 0.85)
  }
  .write(o0)

render(o0)