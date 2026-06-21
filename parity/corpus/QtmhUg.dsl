search synth, filter, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sine)

from(classicNoisedeck, noise(
  xScale: 1,
  yScale: 100,
  loopScale: 99.97,
  speed: 100
))
  .adjust(
    mode: hsv,
    rotation: 120,
    hueRange: 15.64,
    saturation: 1.34,
    brightness: 0.78,
    contrast: 0.83
  )
  .glyphMap(cellSize: 22)
  .subchain(name: "lens effects", id: "dsgd") {
    .snow(alpha: 1, density: 14.89)
    .corrupt(
      intensity: 0.24,
      bandHeight: 44.31,
      sort: 42.78,
      shift: 14.16,
      channelShift: 19.438,
      melt: 29.88,
      scatter: 13.36,
      bits: 34.95,
      seed: 64
    )
    .motionBlur()
    .degauss(displacement: 0.013)
    .chromaticAberration(aberration: 21.52)
    .crt(
      alpha: 0.51,
      speed: 5,
      seed: 23
    )
    .bloom(taps: 15)
    .lens(displacement: osc1)
    .vignette(brightness: 0.2, alpha: 0.88)
  }
  .adjust(brightness: 0.95, contrast: 0.61)
  .write(o0)

render(o0)