search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sine)

shape(
  loopBOffset: noiseBSpline4x4,
  loopAScale: 38.67,
  loopBScale: 26.95,
  speedA: -7,
  speedB: 0
)
  .tile(scale: 4, repeat: 3)
  .historicPalette(
    index: maoriCarving,
    rotation: fwd,
    repeat: 10,
    alpha: 0.27,
    smoothness: 1
  )
  .adjust(
    rotation: -26.24,
    hueRange: 200,
    saturation: 3.03,
    brightness: 0.5,
    contrast: 0.89
  )
  .tunnel(
    scale: -0.1,
    speed: 5,
    rotation: 2,
    center: 0
  )
  .wormhole(
    kink: 0.3,
    stride: 0.85,
    rotation: 98
  )
  .motionBlur(amount: 72.92)
  .blur(radiusX: 3, radiusY: 3)
  .adjust(
    rotation: 113.03,
    hueRange: 200,
    brightness: 0.79,
    contrast: 0.95
  )
  .snow(density: 24.24)
  .crt(speed: 2.2)
  .subchain(name: "lens effects", id: "25k0") {
    .chromaticAberration(aberration: 25)
    .bloom(threshold: 0.45, taps: 15)
    .lens(displacement: -0.86)
    .vignette(brightness: 0.13)
  }
  .write(o0)

render(o0)