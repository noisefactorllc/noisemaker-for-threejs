search user, synth, filter, render, points, mixer, classicNoisedeck

let osc1 = osc(type: oscKind.sine)
chromeicosahedroninterior(
  reflections: 10,
  glowIntensity: 1.57,
  chromeShift: 0.01,
  cameraOffset: 0.4
)
  .tunnel(
    shape: square,
    scale: -0.1,
    speed: osc1,
    rotation: 1,
    center: 69.41
  )
  .invert()
  .subchain(name: "lens effects", id: "vm25") {
    .chromaticAberration(aberration: 43.85, passthru: 48.48)
    .bloom(threshold: 0.3, taps: 15)
    .lens(displacement: -0.43)
    .vignette()
  }
  .write(o0)

render(o0)