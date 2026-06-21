search synth, filter, render, points, mixer

julia(
  poi: galaxy,
  outputMode: stripeAverage,
  iterations: 1000,
  cReal: -1.36,
  cImag: -1.448,
  centerX: -0.53,
  centerY: -0.216,
  rotation: 125.6,
  cSpeed: 0.29,
  cRadius: 0.178,
  zoomDepth: 2.629,
  stripeFreq: 4.539,
  trapShape: circle,
  lightAngle: 229.347
)
  .tetraCosine(
    colorMode: oklab,
    offsetR: 0.85,
    offsetG: 0.697,
    offsetB: 0.876,
    ampR: 0.99,
    ampG: 0.21,
    ampB: 0.356,
    freqR: 3,
    freqG: 4,
    phaseR: 0.519,
    phaseG: 0.71,
    phaseB: 0.942,
    repeat: 3,
    offset: 0.62,
    alpha: 0.938
  )
  .lighting(_skip: true)
  .grain(alpha: 0.2, pause: true)
  .adjust(
    rotation: -16.4,
    hueRange: 102.78,
    saturation: 0.81,
    brightness: 0.78,
    contrast: 0.68
  )
  .subchain(name: "lens effects", id: "016z") {
    .chromaticAberration(aberration: 13.98)
    .bloom(threshold: 0.35, taps: 15)
    .lens(displacement: -0.53)
    .vignette(alpha: 0.76)
  }
  .write(o0)

render(o0)