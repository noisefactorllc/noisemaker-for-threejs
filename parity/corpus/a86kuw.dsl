search filter, synth, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sawInv, speed: 3)

noise(
  octaves: 1,
  scaleX: 100,
  scaleY: 100,
  seed: 53,
  ridges: true,
  loopScale: 100,
  speed: 100
)
  .seamless(blend: 0.18, repeat: 1)
  .tunnel(
    scale: -1,
    speed: -5,
    rotation: 2,
    center: -95.58
  )
  .cellRefract(
    amount: 100,
    speed: 5,
    shape: circle,
    scale: 93.77,
    cellScale: 95.62,
    smooth: 100,
    variation: 100,
    seed: 73,
    effectWidth: 6
  )
  .adjust(
    rotation: 146.16,
    hueRange: 76.05,
    saturation: 0.71,
    contrast: 0.67
  )
  .motionBlur(amount: 100)
  .lighting(
    normalStrength: 5,
    smoothing: 7.1,
    specularIntensity: 1.19,
    lightDirection: vec3(0.356, -0.278, 0.892),
    reflection: 29.8,
    refraction: 19,
    aberration: 27.6
  )
  .subchain(name: "lens effects", id: "0nhw") {
    .bloom(
      threshold: 0.7,
      intensity: 0.6,
      taps: 15
    )
    .lens(displacement: -0.43)
    .vignette(brightness: 0.14)
  }
  .write(o0)

render(o0)