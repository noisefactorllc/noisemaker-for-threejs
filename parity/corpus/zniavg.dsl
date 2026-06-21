search filter, synth

gradient(
  type: spiral,
  rotation: -63.524,
  speed: -2,
  seed: 36,
  color1: #ea76e8,
  color2: #717da8,
  color3: #cf5aa4,
  color4: #de4aa0
)
  .tetraCosine(
    offsetR: 0.916,
    offsetG: 0.801,
    offsetB: 0.94,
    ampR: 0.879,
    ampG: 0.933,
    ampB: 0.344,
    freqR: 3,
    freqG: 4,
    freqB: 2,
    phaseR: 0.078,
    phaseG: 0.808,
    phaseB: 0.667,
    repeat: 4,
    offset: 0.498,
    alpha: 0.542
  )
  .write(o0)

render(o0)