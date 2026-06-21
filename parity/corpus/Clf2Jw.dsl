search synth, filter

julia(
  poi: galaxy,
  outputMode: stripeAverage,
  iterations: 1000,
  cReal: -1.36,
  cImag: -1.448,
  centerX: -0.53,
  centerY: -0.241,
  rotation: 161.27,
  cSpeed: 0.29,
  cRadius: 0.178,
  zoomDepth: 2.824,
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
    rotation: fwd,
    repeat: 3,
    offset: 0.62,
    alpha: 0.86
  )
  .lighting(normalStrength: 1.95, smoothing: 1.3)
  .grain(alpha: 0.2, pause: true)
  .adjust(
    rotation: -34.98,
    hueRange: 102.78,
    saturation: 0.81,
    brightness: 0.89,
    contrast: 0.74
  )
  .write(o0)

render(o0)