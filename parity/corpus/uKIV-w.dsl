search synth, filter, render, points, mixer, classicNoisedeck

perlin(
  scale: 18.75,
  octaves: 2,
  dimensions: 3,
  ridges: true,
  seed: 58
)
  .lighting(
    normalStrength: 5,
    smoothing: 10,
    reflection: 44,
    refraction: 31.4,
    aberration: 28.4
  )
  .subchain(name: "particles", id: "se9k") {
    .pointsEmit(
      stateSize: x64,
      seed: 35,
      attrition: 1.52
    )
    .flow(
      behavior: chaotic,
      stride: 25,
      strideDeviation: 0.5,
      kink: 2.2
    )
    .pointsBillboardRender(
      shapeMode: soft,
      depositOpacity: 41.01,
      pointSize: 15,
      sizeVariation: 100,
      density: 20.93,
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
    rotation: -89.87,
    hueRange: 40.8,
    saturation: 0.77,
    brightness: 2.06
  )
  .coalesce(
    tex: read(o0),
    blendMode: multiply,
    mix: -19.93
  )
  .lighting(normalStrength: 0, refraction: 22.2)
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