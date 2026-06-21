search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.noise, max: 0.15, seed: 7292)
let osc2 = osc(type: oscKind.noise, max: 0.05)
let osc3 = osc(type: oscKind.noise, max: 0.23, seed: 7553)

gradient(
  type: fourCorners,
  rotation: 30.029,
  repeat: 2,
  speed: 1,
  seed: 97,
  color1: #fefaefff,
  color2: #92a06bff,
  color3: #222e76ff,
  color4: #e19e47ff
)
  .seamless(blend: 0.22, repeat: 1)
  .warp(
    strength: 35.19,
    scale: 0.66,
    speed: 2
  )
  .historicPalette(
    index: kenteCloth,
    rotation: fwd,
    repeat: 2,
    alpha: 0.86,
    smoothness: 1
  )
  .wormhole(
    stride: 2,
    rotation: 31,
    alpha: 0.979
  )
  .translate(x: osc1, y: osc3)
  .rotate(rotation: osc2)
  .blur(radiusX: 3, radiusY: 3)
  .adjust(
    rotation: -116.77,
    hueRange: 200,
    brightness: 0.79,
    contrast: 0.95
  )
  .subchain(name: "lens effects", id: "1epb") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette()
  }
  .write(o0)

render(o0)