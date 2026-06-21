search filter, synth, render, points, mixer

mnca(
  tex: read(o1),
  zoom: x4,
  smoothing: bSpline4x4,
  speed: 92.77,
  weight: 41.45,
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
    colorMode: oklch,
    offsetR: 0.224,
    offsetG: 0.804,
    offsetB: 0.027,
    ampR: 0.324,
    ampG: 0.602,
    ampB: 0.567,
    freqR: 3,
    freqB: 4,
    phaseR: 0.915,
    phaseG: 0.428,
    phaseB: 0.337,
    rotation: fwd,
    repeat: 0.46,
    offset: 0.83,
    alpha: 0.988
  )
  .lighting(
    normalStrength: 0.99,
    smoothing: 4.2,
    reflection: 17.4,
    refraction: 14.2,
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

gabor(
  scale: 66.82,
  orientation: -79.79,
  bandwidth: 68.83,
  isotropy: 8.76,
  density: 5,
  octaves: 2,
  speed: 5,
  seed: 47
)
  .write(o1)

render(o0)