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
  .adjust(
    rotation: osc1,
    hueRange: 33.48,
    saturation: 2.68,
    brightness: 1.45,
    contrast: 0.44
  )
  .tunnel(
    scale: -1,
    speed: 5,
    rotation: 1,
    center: -63.98
  )
  .cellRefract(
    amount: 31.23,
    direction: 360,
    speed: 5,
    shape: circle,
    scale: 91.09,
    cellScale: 77.48,
    smooth: 100,
    variation: 100,
    seed: 24,
    effectWidth: 6
  )
  .adjust(
    rotation: -73.72,
    hueRange: 200,
    saturation: 0.82,
    contrast: 0.67
  )
  .motionBlur()
  .lighting(
    normalStrength: 5,
    smoothing: 5.2,
    specularIntensity: 1.19,
    lightDirection: vec3(0.356, -0.278, 0.892),
    reflection: 29.8,
    refraction: 30.1,
    aberration: 27.6
  )
  .subchain(name: "lens effects", id: "0nhw") {
    .prismaticAberration(
      aberration: 38.69,
      modulate: true,
      hueRange: 100,
      saturation: -86.58,
      passthru: 70.78
    )
    .bloom(intensity: 0.6, taps: 15)
    .lens(displacement: -0.5)
    .vignette()
  }
  .write(o0)

render(o0)