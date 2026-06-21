search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sawInv)
let osc2 = osc(type: oscKind.noise, min: 0.65, max: 0.9, seed: 4220)
let osc3 = osc(type: oscKind.noise, min: 0.44, max: 0.68)

julia(
  poi: manual,
  outputMode: distance,
  iterations: 720,
  cReal: osc3,
  cPath: circle,
  cSpeed: 1,
  cRadius: 0.84
)
  .seamless(blend: 0.17, repeat: 1)
  .translate(y: osc1)
  .posterize(levels: 32)
  .wormhole(
    kink: 0.1,
    stride: 1.58,
    rotation: osc3
  )
  .edge(
    size: kernel7x7,
    channel: luminance,
    amount: 500,
    threshold: 54.55
  )
  .pixelSort(angled: osc3)
  .tetraColorArray(
    colorMode: oklab,
    colorCount: 4,
    color0: #50ce5a,
    color1: #bb5ee9,
    color2: #e6d4fc,
    color3: #a9873f,
    color4: #1f13d8,
    color5: #22841e,
    color6: #3bcb4c,
    color7: #6d3c7b,
    repeat: 4,
    offset: 0.169,
    alpha: 0.562,
    smoothness: 0.362
  )
  .subchain(name: "lens effects", id: "c9dk") {
    .snow(alpha: 0.86, density: 9.93)
    .chromaticAberration(aberration: 25)
    .bloom(
      threshold: 0.75,
      softKnee: 0.27,
      intensity: 0.55,
      taps: 32
    )
    .lens(displacement: -0.5)
    .vignette(brightness: 0.26, alpha: 0.81)
    .motionBlur(amount: 52.96)
    .smooth()
  }
  .adjust(
    saturation: 0.83,
    brightness: 0.89,
    contrast: 0.82
  )
  .write(o0)

render(o0)