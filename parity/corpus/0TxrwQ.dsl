search filter, synth

cellularAutomata(
  zoom: x64,
  ruleIndex: size34Life,
  smoothing: bSpline4x4,
  speed: 18.73
)
  .ridge()
  .tetraCosine(
    offsetR: 0.489,
    offsetG: 0.397,
    offsetB: 0.377,
    ampR: 0.353,
    ampG: 0.258,
    ampB: 0.208,
    phaseR: 0.448,
    phaseG: 0.15,
    phaseB: 0.971,
    rotation: fwd
  )
  .lighting(
    normalStrength: 5,
    smoothing: 3.8,
    specularIntensity: 1.25,
    shininess: 256
  )
  .texture(
    mode: crosshatch,
    alpha: 1,
    scale: 1.3
  )
  .write(o0)

render(o0)