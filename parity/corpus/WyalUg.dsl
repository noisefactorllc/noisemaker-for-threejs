search user, synth, filter, render, points, mixer

vaporwaveflyover(
  speed: 3,
  terrainScale: 2.46,
  glowIntensity: 0.47
)
  .wormhole(
    kink: 0.6,
    stride: 0.74,
    rotation: 121
  )
  .subchain(name: "lens effects", id: "0qs1") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.32)
    .vignette()
  }
  .write(o0)

render(o0)