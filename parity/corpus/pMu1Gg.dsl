search filter, synth

shape(
  loopAOffset: noiseBSpline4x4,
  loopBOffset: noiseBSpline4x4,
  loopBScale: 100,
  speedA: -100,
  speedB: 100,
  seed: 50
)
  .historicPalette(
    index: popArt,
    rotation: fwd,
    repeat: 2
  )
  .edge(
    size: kernel7x7,
    channel: luminance,
    amount: 495.33,
    invert: on,
    blend: multiply
  )
  .adjust(
    saturation: 0.74,
    brightness: 0.74,
    contrast: 0.68
  )
  .grain(alpha: 0.19)
  .write(o0)

render(o0)