search synth, filter, render, points, mixer

modPattern(
  scale1: 16.72,
  repeat1: 15.411,
  shape2: diamond,
  scale2: 8.48,
  repeat2: 4.461,
  shape3: plus,
  scale3: 1.595,
  repeat3: 2.172,
  animMode: phase
)
  .tile(
    symmetry: rotate6,
    scale: 1.95,
    offsetX: -0.07,
    offsetY: -0.09,
    angle: 151,
    repeat: 1
  )
  .tetraCosine(
    colorMode: hsv,
    offsetR: 0.921,
    offsetG: 0.897,
    offsetB: 0.782,
    ampR: 0.552,
    ampG: 0.601,
    ampB: 0.866,
    freqR: 4,
    freqG: 2,
    freqB: 3,
    phaseR: 0.724,
    phaseG: 0.849,
    phaseB: 0.355,
    rotation: fwd,
    repeat: 0.72,
    offset: 0.576,
    alpha: 0.76
  )
  .tunnel(
    shape: square,
    scale: -1,
    center: -100
  )
  .lighting(
    normalStrength: 2.13,
    smoothing: 4.9,
    reflection: 16,
    aberration: 19.8
  )
  .subchain(name: "lens effects", id: "jx9z") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -1)
    .vignette(brightness: 0.14, alpha: 0.83)
  }
  .adjust(
    rotation: 42.67,
    hueRange: 200,
    saturation: 1.88,
    brightness: 1.04,
    contrast: 0.52
  )
  .write(o0)

render(o0)