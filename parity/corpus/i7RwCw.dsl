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
    hueRange: 97.99,
    brightness: 2.61,
    contrast: 0.56
  )
  .warp(
    strength: 2.16,
    scale: 5,
    speed: 5
  )
  .blur()
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  zoom: x16,
  sourceF: sliderInput,
  feed: 78.17,
  kill: 56.47,
  rate1: 86.94,
  rate2: 24.02,
  iterations: 13,
  weight: 45.54,
  inputIntensity: 19.86
)
  .lighting(
    normalStrength: 5,
    smoothing: 2.2,
    reflection: 9.9,
    refraction: 21.3,
    aberration: 17.5
  )
  .grain(alpha: 0.1)
  .adjust(
    rotation: -87.3,
    brightness: 1.15,
    contrast: 0.69
  )
  .write(o1)

render(o1)