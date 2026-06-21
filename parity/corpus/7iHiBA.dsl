search synth, filter, synth3d, render, points, mixer, classicNoisedeck

cell(
  scale: 82.16,
  cellScale: 65.95,
  variation: 35.15,
  speed: 2
)
  .refract(
    blendMode: negation,
    mix: 47.33,
    mode: reflect,
    amount: 100
  )
  .subchain(name: "flow field particles", id: "df58") {
    .pointsEmit(attrition: 4.21)
    .flow(
      behavior: chaotic,
      stride: 38,
      strideDeviation: 0.5,
      kink: 1.4
    )
    .hydraulic(stride: 21)
    .pointsBillboardRender(
      depositOpacity: 5.29,
      pointSize: 39.26,
      sizeVariation: 100,
      seed: 474,
      density: 1.07,
      intensity: 86.64,
      inputIntensity: 100
    )
  }
  .blur(radiusX: 6, radiusY: 6)
  .invert()
  .lighting(
    normalStrength: 3.65,
    specularIntensity: 0.87,
    shininess: 166,
    lightDirection: vec3(0.522, 0.467, 0.714),
    reflection: 21.6,
    refraction: 13.5,
    aberration: 21.6
  )
  .grain(alpha: 0.13)
  .subchain(name: "lens effects", id: "ddno") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.23)
  }
  .write(o0)

render(o0)