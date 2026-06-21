search filter, synth

mnca(
  tex: read(o1),
  zoom: x16,
  smoothing: bSpline4x4,
  speed: 89.359,
  weight: 30.71,
  n1v1: 38.46,
  n1r1: 29.363,
  n1v2: 65.617,
  n1r2: 56.029,
  n1v3: 45.66,
  n1r3: 78.463,
  n1v4: 24.863,
  n1r4: 64.73,
  n2v1: 93.195,
  n2r1: 66.04,
  n2v2: 37.783,
  n2r2: 50.28
)
  .tetraCosine(
    colorMode: oklab,
    offsetR: 0.156,
    offsetG: 0.462,
    offsetB: 0.484,
    ampR: 0.342,
    ampG: 0.95,
    ampB: 0.322,
    freqR: 2,
    freqG: 4,
    freqB: 0,
    phaseR: 0.465,
    phaseG: 0.972,
    phaseB: 0.592,
    repeat: 4.8,
    alpha: 0.43
  )
  .lighting(normalStrength: 1.21, smoothing: 4.7)
  .write(o0)

gabor(
  orientation: -47.7,
  isotropy: 31.02,
  density: 5,
  speed: 5
)
  .write(o1)

render(o0)