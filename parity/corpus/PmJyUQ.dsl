search user, synth, filter, render, points, mixer, classicNoisedeck

chromeicosahedroninterior(
  reflections: 10,
  glowIntensity: 0.95,
  chromeShift: 0.01,
  cameraOffset: 0.3
)
  .tile(
    symmetry: rotate6,
    offsetY: -0.26,
    repeat: 3
  )
  .tunnel(
    scale: -0.7,
    speed: -5,
    rotation: -1,
    center: -78.26
  )
  .subchain(name: "lens effects", id: "vm25") {
    .chromaticAberration(aberration: 43.85)
    .bloom(threshold: 0.3, taps: 15)
    .lens(displacement: -1)
    .vignette(brightness: 0.19)
  }
  .write(o0)

render(o0)