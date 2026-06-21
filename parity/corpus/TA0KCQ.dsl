search synth, filter, classicNoisedeck

let osc1 = osc(type: oscKind.sine, speed: 3)
let osc2 = osc(type: oscKind.noise, seed: 9368)
let osc3 = osc(type: oscKind.noise, seed: 1311)
let osc4 = osc(type: oscKind.noise, seed: 3626)

cellularAutomata(
  tex: read(o4),
  ruleIndex: waffles,
  smoothing: catmullRom3x3,
  speed: 100,
  weight: 69.94
)
  .adjust(
    mode: hsv,
    rotation: osc1,
    hueRange: 58.5
  )
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  zoom: x32,
  smoothing: bSpline4x4,
  sourceF: sliderInput,
  feed: 85.23,
  kill: 59.38,
  rate1: 79.53,
  rate2: 24.48,
  weight: 80.98,
  inputIntensity: osc4
)
  .write(o1)

reactionDiffusion(
  tex: read(o1),
  zoom: x16,
  smoothing: bSpline4x4,
  sourceF: brightness,
  feed: 88.69,
  kill: 56.45,
  rate1: 98.83,
  rate2: 23.39,
  weight: 79.37,
  inputIntensity: osc3
)
  .write(o2)

reactionDiffusion(
  tex: read(o2),
  zoom: x2,
  smoothing: bSpline4x4,
  sourceF: sliderInput,
  feed: 31.52,
  kill: 55.71,
  rate1: 94.75,
  rate2: 43.79,
  weight: 78.85,
  inputIntensity: osc2
)
  .write(o3)

read(o3)
  .tetraColorArray(rotation: fwd, repeat: 2.9)
  .lighting(
    normalStrength: 5,
    smoothing: 1.3,
    specularIntensity: 1.24,
    shininess: 86,
    lightDirection: vec3(0.322, 0.694, 0.643),
    reflection: 15.9,
    refraction: 23.2,
    aberration: 28
  )
  .adjust(saturation: 0.55, contrast: 0.62)
  .write(o4)

render(o4)