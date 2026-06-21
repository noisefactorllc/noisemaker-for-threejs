search synth, filter, render, points, mixer

perlin(
  scale: 55.76,
  octaves: 3,
  colorMode: mono,
  dimensions: 3,
  warpIterations: 4,
  warpScale: 60.04,
  warpIntensity: 40.84,
  seed: 61
)
  .tetraCosine(
    colorMode: hsv,
    offsetR: 0.358,
    offsetG: 0.156,
    offsetB: 0.28,
    ampR: 0.725,
    ampG: 0.727,
    ampB: 0.731,
    freqR: 2,
    freqG: 3,
    freqB: 4,
    phaseR: 0.06,
    phaseG: 0.298,
    phaseB: 0.406,
    repeat: 0.69
  )
  .lighting(
    normalStrength: 5,
    smoothing: 3,
    reflection: 61.6,
    refraction: 53.8,
    aberration: 25.4
  )
  .subchain(name: "lens effects", id: "hx21") {
    .chromaticAberration(aberration: 25.15)
    .bloom(
      threshold: 0.95,
      softKnee: 0.32,
      intensity: 1.6,
      taps: 32
    )
    .lens(displacement: -0.5)
    .vignette()
  }
  .write(o0)

render(o0)