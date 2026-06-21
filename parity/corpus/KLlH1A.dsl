search synth, filter, classicNoisedeck, render, points, mixer

perlin(scale: 30.81, ridges: true)
  .kaleido(
    sides: 13,
    metric: square,
    loopOffset: square,
    loopScale: 20.11,
    speed: 12.74,
    direction: clockwise,
    _skip: true
  )
  .subchain(name: "particle lenia", id: "1eyj") {
    .pointsEmit(attrition: 3.38)
    .lenia(
      muK: 16.5,
      sigmaK: 7.6,
      searchRadius: 20,
      depositAmount: 3.4
    )
    .flow(
      behavior: chaotic,
      stride: 50,
      strideDeviation: 0,
      kink: 5.8
    )
    .pointsRender(
      density: 100,
      intensity: 47.95,
      inputIntensity: 31.32
    )
  }
  .blur(radiusX: 12, radiusY: 12)
  .adjust(mode: hsv, rotation: 22.94)
  .lighting(
    normalStrength: 3.36,
    smoothing: 9.8,
    reflection: 16.9,
    refraction: 13.9,
    aberration: 17.7
  )
  .adjust(
    hueRange: 200,
    saturation: 1.78,
    brightness: 1.53,
    contrast: 0.62
  )
  .write(o0)

render(o0)