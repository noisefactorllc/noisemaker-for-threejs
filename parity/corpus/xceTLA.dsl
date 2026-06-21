search user, synth, filter, render, points, mixer, classicNoisedeck

noise(
  octaves: 1,
  scaleX: 100,
  scaleY: 100,
  ridges: true,
  loopScale: 88.32,
  speed: 100
)
  .adjust(
    mode: hsv,
    rotation: -106.84,
    hueRange: 200,
    saturation: 0.55
  )
  .lowPoly(
    scale: 89,
    seed: 28,
    mode: distance2,
    edgeStrength: 1,
    alpha: 0.52
  )
  .subchain(name: "feedback loop with warp", id: "29dv") {
    .loopBegin(alpha: 93.8, intensity: 95.03)
    .cellRefract(
      amount: 1.47,
      speed: 5,
      shape: circle,
      scale: 74.49,
      cellScale: 78.88,
      smooth: 57.32,
      variation: 100,
      seed: 59
    )
    .adjust(rotation: 28.43, hueRange: 85.1)
    .loopEnd()
  }
  .lighting()
  .subchain(name: "lens effects", id: "vkst") {
    .prismaticAberration(
      aberration: 100,
      modulate: true,
      hueRotation: 180,
      hueRange: 100,
      saturation: -100,
      passthru: 50.41
    )
    .bloom(
      threshold: 0.95,
      intensity: 0.5,
      taps: 38
    )
    .lens(displacement: -0.54)
    .vignette(brightness: 0.19)
  }
  .adjust(
    hueRange: 200,
    saturation: 1.83,
    contrast: 0.57
  )
  .write(o0)

render(o0)