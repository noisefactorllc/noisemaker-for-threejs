search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.noise, max: 0.15, seed: 7292)
let osc2 = osc(type: oscKind.noise, max: 0.05)
let osc3 = osc(type: oscKind.noise, max: 0.23, seed: 7553)
let osc4 = osc(type: oscKind.sawInv, speed: 10)

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
  .seamless(blend: 0.18, repeat: 1)
  .warp(
    strength: 35.19,
    scale: 0.68,
    speed: 4
  )
  .historicPalette(
    index: kenteCloth,
    rotation: fwd,
    offset: osc4,
    repeat: 3,
    alpha: 0.86,
    smoothness: 1
  )
  .wormhole(
    kink: 2.1,
    stride: 2,
    rotation: 31,
    alpha: 0.979
  )
  .motionBlur(amount: 100)
  .translate(x: osc1, y: osc3)
  .rotate(rotation: osc2)
  .blur(radiusX: 3, radiusY: 3)
  .subchain(name: "lens effects", id: "1epb") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.11)
  }
  .adjust(
    rotation: -116.77,
    hueRange: 200,
    brightness: 1.44,
    contrast: 0.58
  )
  .write(o0)

render(o0)