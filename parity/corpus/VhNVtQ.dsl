search synth, filter, classicNoisedeck

let osc1 = osc(type: oscKind.sine)

perlin(scale: 18.02, octaves: 2)
  .kaleido(sides: 6)
  .tile(
    symmetry: rotate6,
    offsetY: -0.48,
    angle: 45,
    repeat: 3
  )
  .adjust(
    mode: oklch,
    rotation: 138.52,
    hueRange: 200,
    brightness: 2.61,
    contrast: 0.56
  )
  .warp(
    strength: 21.19,
    scale: 1.39,
    seed: 14,
    speed: 5
  )
  .blur()
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  smoothing: bSpline4x4,
  sourceF: sliderInput,
  feed: 66.28,
  kill: 59.33,
  rate1: 97.99,
  rate2: 21.64,
  iterations: 14,
  weight: 45.54,
  inputIntensity: 16.62
)
  .lighting(
    normalStrength: 2.34,
    smoothing: 2,
    specularIntensity: 0.71,
    shininess: 72,
    reflection: 22.1,
    refraction: 15.2,
    aberration: 13
  )
  .grain(alpha: 0.1)
  .adjust(
    rotation: 35.64,
    saturation: 1.25,
    brightness: 1.04,
    contrast: 0.71
  )
  .write(o1)

render(o1)