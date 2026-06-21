search filter, synth, classicNoisedeck, render, points, mixer

noise(
  octaves: 1,
  scaleX: 100,
  scaleY: 100,
  seed: 53,
  ridges: true,
  loopScale: 100,
  speed: 100
)
  .adjust(
    rotation: -180,
    hueRange: 200,
    saturation: 4,
    brightness: 0.39,
    contrast: 0.36
  )
  .cellRefract(
    amount: 19.96,
    direction: 360,
    speed: 5,
    shape: circle,
    scale: 51.4,
    cellScale: 100,
    smooth: 100,
    variation: 100
  )
  .adjust(
    rotation: -73.72,
    hueRange: 200,
    saturation: 0.82
  )
  .lighting(
    normalStrength: 5,
    smoothing: 3.6,
    specularIntensity: 1.19,
    lightDirection: vec3(0.356, -0.278, 0.892),
    reflection: 29.8,
    refraction: 30.1,
    aberration: 27.6
  )
  .subchain(name: "lens effects", id: "0nhw") {
    .prismaticAberration(
      aberration: 100,
      hueRange: 100,
      saturation: -100,
      passthru: 42.13
    )
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette()
  }
  .adjust(saturation: 1.33, brightness: 1.34)
  .write(o0)

render(o0)