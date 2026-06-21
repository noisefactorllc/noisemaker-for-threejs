search synth, filter, classicNoisedeck, render, points, mixer

cell(
  scale: 74.26,
  cellScale: 82.04,
  cellSmooth: 100,
  variation: 100,
  speed: 2
)
  .blendMode(
    tex: read(o1),
    mode: multiply,
    mix: 7.6
  )
  .palette(
    index: solaris,
    offset: 25,
    alpha: 0.53
  )
  .subchain(name: "flow field particles", id: "x3b2") {
    .pointsEmit(attrition: 10)
    .flow(behavior: chaotic, kink: 0.7)
    .hydraulic(stride: 25)
    .pointsRender(
      density: 100,
      intensity: 97.5,
      inputIntensity: 68.05
    )
    .blur()
  }
  .subchain(name: "feedback loop with warp", id: "e5l6") {
    .loopBegin(alpha: 97.5, intensity: 97.5)
    .warp(
      strength: 1,
      scale: 2.77,
      seed: 28,
      speed: 3
    )
    .loopEnd()
  }
  .warp(
    strength: 0.52,
    scale: 5,
    speed: 5
  )
  .adjust(
    saturation: 1.54,
    brightness: 0.86,
    contrast: 0.53
  )
  .subchain(name: "lens effects", id: "ow0o") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.75, alpha: 0.51)
  }
  .adjust(
    rotation: -15.59,
    saturation: 0.68,
    contrast: 0.45
  )
  .write(o0)

perlin()
  .write(o1)

render(o0)