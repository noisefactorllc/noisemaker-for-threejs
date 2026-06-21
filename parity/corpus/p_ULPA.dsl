search synth, filter, render, points, mixer, classicNoisedeck

perlin(
  scale: 21.83,
  octaves: 2,
  colorMode: mono,
  dimensions: 3,
  seed: 17
)
  .lighting(
    normalStrength: 5,
    smoothing: 10,
    reflection: 44,
    refraction: 31.4,
    aberration: 28.4
  )
  .subchain(name: "physarum particles", id: "se9k") {
    .pointsEmit(
      stateSize: x64,
      layout: center,
      seed: 16,
      attrition: 0.5
    )
    .flow(
      behavior: chaotic,
      stride: 17,
      strideDeviation: 0.5,
      kink: 10
    )
    .pointsBillboardRender(
      shapeMode: soft,
      depositOpacity: 28.39,
      pointSize: 21.29,
      sizeVariation: 100,
      density: 21.8,
      intensity: 74.91,
      inputIntensity: 100
    )
    .pointsRender(
      density: 100,
      intensity: 98.84,
      inputIntensity: 59.39
    )
  }
  .write(o0)

perlin(scale: 22.15, dimensions: 3)
  .adjust(
    mode: hsv,
    rotation: -77.24,
    hueRange: 44.24
  )
  .coalesce(
    tex: read(o0),
    blendMode: multiply,
    mix: -1.16
  )
  .subchain(name: "lens effects", id: "a9tw") {
    .chromaticAberration(aberration: 25)
    .bloom(
      threshold: 0.7,
      intensity: 0.75,
      taps: 30
    )
    .lens(displacement: -0.5)
    .vignette(brightness: 0.08)
  }
  .write(o1)

render(o1)