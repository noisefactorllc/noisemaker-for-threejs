search user, synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sine)

chromeicosahedroninterior(
  reflections: 10,
  glowIntensity: 1.02,
  chromeShift: 0.01,
  cameraOffset: osc1
)
  .subchain(name: "lens effects", id: "vm25") {
    .chromaticAberration(aberration: 69.95)
    .bloom(threshold: 1, taps: 15)
    .lens(displacement: -0.43)
    .vignette(brightness: 0.17, alpha: 0.96)
  }
  .write(o0)

render(o0)