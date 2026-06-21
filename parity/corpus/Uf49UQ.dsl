search synth, filter, synth3d, render, points, mixer, classicNoisedeck

gabor(
  scale: 94.71,
  orientation: -98.42,
  bandwidth: 24.97,
  isotropy: 100,
  density: 4,
  octaves: 4,
  speed: 5,
  seed: 34
)
  .refract(
    blendMode: negation,
    mode: reflect,
    amount: 77.22
  )
  .subchain(name: "flow field particles", id: "df58") {
    .pointsEmit(attrition: 10)
    .flow(
      behavior: chaotic,
      stride: 39,
      strideDeviation: 0.5
    )
    .hydraulic(stride: 21)
    .pointsBillboardRender(
      depositOpacity: 5.25,
      pointSize: 39.26,
      sizeVariation: 100,
      seed: 474,
      density: 0.78,
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