search synth, filter, classicNoisedeck, render, points, mixer

let osc1 = osc(type: oscKind.sine, speed: 3)
let osc2 = osc(type: oscKind.noise, seed: 9368)
let osc3 = osc(type: oscKind.noise, seed: 1311)
let osc4 = osc(type: oscKind.noise, seed: 3626)
let osc5 = osc(type: oscKind.sawInv)

cellularAutomata(
  tex: read(o4),
  zoom: x64,
  ruleIndex: pondLife,
  smoothing: catmullRom4x4,
  speed: 100,
  weight: 100
)
  .adjust(
    mode: hsv,
    rotation: osc1,
    hueRange: 58.5,
    saturation: 1.5
  )
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  zoom: x32,
  smoothing: catmullRom4x4,
  sourceF: sliderInput,
  feed: 85.23,
  kill: 59.38,
  rate1: 79.53,
  rate2: 24.48,
  weight: 88.51,
  inputIntensity: osc4
)
  .write(o1)

reactionDiffusion(
  tex: read(o1),
  zoom: x16,
  smoothing: catmullRom4x4,
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
  zoom: x4,
  smoothing: catmullRom4x4,
  sourceF: sliderInput,
  feed: 31.52,
  kill: 55.71,
  rate1: 94.75,
  rate2: 43.79,
  weight: 45.9,
  inputIntensity: osc2
)
  .write(o3)

read(o3)
  .subchain(name: "feedback loop", id: "zzk1") {
    .loopBegin(alpha: 85.95)
    .warp(strength: 6.99, scale: 0.2)
    .feedback(mix: 40.61, refractBAmt: 8.39)
    .loopEnd()
  }
  .tetraCosine(
    colorMode: oklch,
    offsetR: 0.121,
    offsetG: 0.432,
    offsetB: 0.67,
    ampR: 0.369,
    ampG: 0.332,
    ampB: 0.676,
    freqR: 4,
    freqG: 4,
    phaseR: 0.895,
    phaseG: 0.417,
    phaseB: 0.782,
    repeat: 0.72,
    offset: 0.96,
    alpha: 0.65
  )
  .lighting(
    normalStrength: 5,
    smoothing: 6.6,
    reflection: 22.3,
    refraction: 27.4,
    aberration: 26.5
  )
  .adjust(
    rotation: osc5,
    saturation: 0.79,
    brightness: 1.61,
    contrast: 0.72
  )
  .write(o4)

render(o4)