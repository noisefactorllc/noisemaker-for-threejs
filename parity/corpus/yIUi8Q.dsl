search filter, synth

gradient(
  type: linear,
  rotation: -63.524,
  speed: 2,
  seed: 36,
  color1: #ea76e8,
  color2: #717da8,
  color3: #cf5aa4,
  color4: #de4aa0
)
  .tetraCosine(
    colorMode: oklab,
    offsetR: 0.691,
    offsetG: 0.074,
    offsetB: 0.258,
    ampR: 0.699,
    ampG: 0.822,
    ampB: 0.948,
    freqR: 2,
    freqG: 2,
    freqB: 2,
    phaseR: 0.334,
    phaseG: 0.035,
    phaseB: 0.35,
    rotation: fwd,
    repeat: 10,
    offset: 0.426,
    alpha: 0.57
  )
  .write(o0)

render(o0)