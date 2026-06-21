search synth, filter, mixer, render, points

pattern(
  type: triangularGrid,
  scale: 16.65,
  thickness: 0.82,
  smoothness: 1,
  rotation: 45
)
  .blendMode(tex: read(o3), mode: softLight)
  .subchain(name: "feedback loop with waves", id: "n5un") {
    .loopBegin(alpha: 95.08, intensity: 99.28)
    .warp(
      strength: 14.05,
      scale: 0.72,
      speed: 1
    )
    .feedback(
      mix: 74.58,
      refractAAmt: 10.97,
      refractBAmt: 6.31
    )
    .loopEnd()
  }
  .write(o0)

read(o0)
  .lighting(
    normalStrength: 5,
    smoothing: 3.2,
    specularIntensity: 0.41,
    shininess: 77,
    lightDirection: vec3(0.189, 0.356, 0.915),
    reflection: 28.7,
    refraction: 25.8,
    aberration: 19.5
  )
  .write(o1)

read(o0)
  .normalMap()
  .blendMode(
    tex: read(o1),
    mode: diff,
    mix: -29.56
  )
  .adjust(
    rotation: -142.01,
    hueRange: 200,
    saturation: 0.78,
    brightness: 0.6,
    contrast: 0.82
  )
  .subchain(name: "lens effects", id: "oa4k") {
    .chromaticAberration(aberration: 19.65)
    .bloom(taps: 15)
    .lens(displacement: -0.45)
    .vignette(brightness: 0.06, alpha: 0.9)
  }
  .write(o2)

perlin()
  .write(o3)

render(o2)