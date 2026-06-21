search synth, filter

let osc1 = osc(type: oscKind.sine)

perlin(
  scale: 18.51,
  dimensions: 3,
  ridges: true,
  seed: 41
)
  .adjust(
    mode: hsv,
    rotation: osc1,
    saturation: 4
  )
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  zoom: x32,
  smoothing: bSpline4x4,
  sourceF: sliderInput,
  feed: 85.89,
  kill: 64.82,
  rate1: 60.24,
  rate2: 24.09,
  weight: 100,
  inputIntensity: 17.53
)
  .write(o1)

reactionDiffusion(
  tex: read(o1),
  smoothing: bSpline4x4,
  sourceF: brightness,
  feed: 110,
  kill: 60.23,
  rate1: 79.44,
  rate2: 32.06,
  weight: 100,
  inputIntensity: 33.62
)
  .write(o2)

reactionDiffusion(
  tex: read(o2),
  zoom: x2,
  smoothing: bSpline4x4,
  sourceF: brightness,
  feed: 56.43,
  kill: 57.61,
  rate1: 81.44,
  rate2: 23.67,
  weight: 100,
  inputIntensity: 91.64
)
  .write(o3)

read(o3)
  .lighting(
    normalStrength: 5,
    smoothing: 1.2,
    specularIntensity: 1.62,
    shininess: 71,
    lightDirection: vec3(0.322, 0.694, 0.643),
    reflection: 21.1,
    refraction: 19.5,
    aberration: 28
  )
  .adjust(
    saturation: 0.55,
    brightness: 1.58,
    contrast: 0.62
  )
  .write(o4)

render(o4)