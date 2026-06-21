search synth, filter, render, points, mixer

perlin(
  scale: 19.94,
  octaves: 2,
  seed: 64
)
  .adjust(
    mode: hsv,
    rotation: 120,
    hueRange: 63.6,
    saturation: 1.54,
    brightness: 1.1,
    contrast: 0.53
  )
  .subchain(name: "particle life", id: "860b") {
    .pointsEmit(attrition: 2.12)
    .life(
      typeCount: 8,
      attractionScale: 3,
      repulsionScale: 2.3,
      minRadius: 0.009,
      maxRadius: 0.1,
      maxSpeed: 0.007,
      friction: 0.96,
      matrixSeed: 629
    )
    .flow(stride: 60, strideDeviation: 0.5)
    .pointsBillboardRender(
      shapeMode: soft,
      depositOpacity: 3.49,
      pointSize: 64,
      sizeVariation: 100,
      density: 9.26,
      intensity: 70.94,
      inputIntensity: 100
    )
    .pointsRender(intensity: 92.42, inputIntensity: 48.91)
  }
  .write(o0)

render(o0)