search synth, filter, mixer, render, points

pattern(
  type: dots,
  scale: 16.68,
  thickness: 0.52,
  smoothness: 1,
  rotation: 45
)
  .subchain(name: "feedback loop with waves", id: "n5un") {
    .loopBegin(alpha: 98.44)
    .warp(
      strength: 4.5,
      scale: 0.35,
      speed: 1
    )
    .loopEnd()
  }
  .write(o0)

read(o0)
  .lighting(
    normalStrength: 2.58,
    smoothing: 3.4,
    reflection: 28.7,
    refraction: 25.8,
    aberration: 19.5
  )
  .write(o1)

read(o0)
  .normalMap()
  .blendMode(tex: read(o1), mode: hardLight)
  .subchain(name: "lens effects", id: "oa4k") {
    .chromaticAberration(aberration: 25)
    .bloom(taps: 15)
    .lens(displacement: -0.5)
    .vignette(brightness: 0.25, alpha: 0.9)
  }
  .write(o2)

render(o2)