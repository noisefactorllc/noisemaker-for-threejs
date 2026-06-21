search user, synth, filter, render, points, mixer, classicNoisedeck

chromeicosahedroninterior(
  reflections: 10,
  glowIntensity: 1.02,
  chromeShift: 0.01
)
  .tunnel(scale: -1, speed: 5)
  .invert()
  .subchain(name: "lens effects", id: "vm25") {
    .chromaticAberration(aberration: 43.85)
    .bloom(threshold: 0.3, taps: 15)
    .lens(displacement: -0.43)
    .vignette()
  }
  .write(o0)

render(o0)