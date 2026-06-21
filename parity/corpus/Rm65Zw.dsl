search filter, synth

bitwise(
  scale: 67.462,
  seed: 57,
  colorMode: hsv,
  colorOffset: 42
)
  .tetraCosine(
    colorMode: hsv,
    offsetR: 0.432,
    offsetG: 0.713,
    offsetB: 0.386,
    ampR: 0.708,
    ampG: 0.847,
    ampB: 0.491,
    freqR: 4,
    freqG: 0,
    freqB: 2,
    phaseR: 0.248,
    phaseG: 0.213,
    phaseB: 0.438,
    rotation: fwd,
    repeat: 4,
    offset: 0.489,
    alpha: 0.628
  )
  .edge(
    kernel: fine,
    amount: 235.25,
    blend: darken
  )
  .scroll(speedY: -1)
  .rotate(rotation: 67.5)
  .write(o0)

render(o0)