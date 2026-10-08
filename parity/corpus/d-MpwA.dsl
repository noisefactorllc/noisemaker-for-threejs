search user, synth, filter, render, points, mixer

aerialsunsetflyover(
  speed: 1,
  terrainScale: 0.5,
  colorSaturation: 0,
  horizonHaze: 1.36,
  lensIntensity: 1.62,
  complexity: 7
)
  .focusBlur(
    focalDistance: 1,
    aperture: 5.4,
    sampleBias: 64
  )
  .subchain(name: "lens effects", id: "75x6") {
    .temporalAberration()
    .bloom(
      threshold: 0.7,
      intensity: 0.3,
      taps: 15,
      tint: #ff8440
    )
    .lens(displacement: -0.5)
    .vignette(brightness: 0.31)
  }
  .write(o0)

render(o0)