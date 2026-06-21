search filter, render, synth

bitwise(scale: 88.39)
  .tetraCosine(
    colorMode: oklab,
    offsetR: 0.418,
    offsetG: 0.513,
    offsetB: 0.458,
    ampR: 0.781,
    ampG: 0.823,
    ampB: 0.306,
    freqR: 3,
    phaseR: 0.107,
    phaseG: 0.571,
    phaseB: 0.329,
    rotation: fwd,
    repeat: 2,
    offset: 1,
    alpha: 0.86
  )
  .subchain(name: "degauss texture", id: "zble") {
    .loopBegin(alpha: 96.723, intensity: 62.924)
    .degauss(
      displacement: 0.041,
      direction: 47.181,
      seed: 14,
      speed: 0.192
    )
    .texture(
      mode: stucco,
      alpha: 0.81,
      scale: 0.1
    )
    .loopEnd()
  }
  .write(o0)

render(o0)