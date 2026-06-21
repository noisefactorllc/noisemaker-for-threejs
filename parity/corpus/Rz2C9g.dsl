search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sawInv)
let osc2 = osc(type: oscKind.noise, min: 0.65, max: 0.9, seed: 4220)

cell(
  shape: diamond,
  scale: osc2,
  cellScale: 89.85,
  cellSmooth: 100,
  variation: 100,
  speed: 5,
  seed: 41
)
  .seamless(blend: 0.17, repeat: 1)
  .translate(y: osc1)
  .posterize(levels: 32)
  .wormhole(
    kink: 0.1,
    rotation: -22,
    alpha: 0.33
  )
  .edge(
    size: kernel7x7,
    channel: luminance,
    amount: 500,
    threshold: 54.55
  )
  .tetraColorArray(
    colorCount: 3,
    color0: #f9f8fd,
    color1: #3ac28a,
    color2: #f89b71,
    color3: #69cdfd,
    color4: #1cc78c,
    color5: #9d533d,
    color6: #8a6b33,
    color7: #aca83c,
    rotation: back,
    repeat: 5,
    offset: 0.776,
    alpha: 0.55,
    smoothness: 0.754
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
    .vignette(brightness: 0.26, alpha: 0.72)
    .motionBlur()
    .smooth()
  }
  .adjust(saturation: 0.83, contrast: 0.82)
  .write(o0)

render(o0)