search filter, synth, render, points, mixer

mnca(
  tex: read(o1),
  smoothing: bSpline4x4,
  speed: 92.77,
  weight: 46.76,
  n1v1: 37.397,
  n1r1: 36.19,
  n1v2: 85.071,
  n1r2: 59.39,
  n1v3: 78.473,
  n1r3: 59.21,
  n1v4: 40.291,
  n1r4: 9.6,
  n2v1: 57.169,
  n2r1: 74.141,
  n2v2: 75.756,
  n2r2: 18.421
)
  .tetraCosine(
    offsetR: 0.459,
    offsetG: 0.168,
    offsetB: 0.284,
    ampR: 0.166,
    ampG: 0.079,
    ampB: 0.398,
    freqR: 2,
    freqG: 3,
    freqB: 3,
    phaseR: 0.719,
    phaseG: 0.681,
    phaseB: 0.814,
    rotation: fwd,
    repeat: 3,
    offset: 0.729,
    alpha: 0.651
  )
  .lighting(
    normalStrength: 0.99,
    smoothing: 3.7,
    reflection: 17.4,
    refraction: 11.1,
    aberration: 17
  )
  .subchain(name: "lens effects", id: "9amq") {
    .prismaticAberration(
      aberration: 100,
      modulate: true,
      hueRange: 100,
      saturation: -100
    )
    .bloom(
      threshold: 0.45,
      intensity: 0.7,
      taps: 33
    )
    .lens(displacement: -0.5)
    .vignette(brightness: 0.18, alpha: 0.77)
  }
  .write(o0)

noise(
  type: catmullRom4x4,
  octaves: 1,
  scaleX: 36.96,
  scaleY: 100,
  seed: 28,
  loopOffset: verticalScan,
  loopScale: 100,
  speed: -100
)
  .write(o1)

render(o0)