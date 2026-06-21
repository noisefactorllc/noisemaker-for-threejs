search synth, filter, render, points, mixer

perlin(
  scale: 15.01,
  octaves: 5,
  speed: 4
)
  .seamless(repeat: 1)
  .adjust(
    mode: hsv,
    rotation: 120,
    hueRange: 40
  )
  .subchain(name: "feedback loop with warp", id: "4cd1") {
    .loopBegin(alpha: 84.19)
    .warp(strength: 11.88, speed: 3)
    .feedback(mix: 69.04, refractBAmt: 8.43)
    .loopEnd()
  }
  .lighting(
    normalStrength: 3.83,
    smoothing: 4.6,
    reflection: 46.6,
    refraction: 51.5,
    aberration: 29.6
  )
  .subchain(name: "lens effects", id: "xdss") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.17, alpha: 0.73)
  }
  .adjust(
    saturation: 0.71,
    brightness: 1.13,
    contrast: 0.77
  )
  .write(o0)

render(o0)