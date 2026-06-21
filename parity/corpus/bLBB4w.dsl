search synth, filter, mixer

perlin(
  scale: 14.19,
  dimensions: 3,
  ridges: true
)
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  smoothing: bSpline3x3,
  sourceF: brightness,
  feed: 80.38,
  kill: 56.89,
  rate1: 99.98,
  rate2: 28.03,
  weight: 100,
  inputIntensity: 36.31
)
  .tetraCosine(
    colorMode: hsv,
    offsetR: 0.274,
    offsetG: 0.388,
    offsetB: 0.53,
    ampR: 0.782,
    ampG: 0.28,
    ampB: 0.461,
    freqG: 0,
    freqB: 3,
    phaseR: 0.749,
    phaseG: 0.093,
    phaseB: 0.1,
    rotation: fwd,
    repeat: 2,
    offset: 0.829,
    alpha: 0.825
  )
  .tile(
    symmetry: rotate6,
    offsetY: 0.1,
    angle: 43,
    repeat: 1
  )
  .reverb(iterations: 8, alpha: 0.4)
  .lighting(
    normalStrength: 5,
    smoothing: 4.3,
    specularIntensity: 0.83,
    shininess: 133,
    reflection: 21.3,
    refraction: 15.1,
    aberration: 19
  )
  .adjust(
    rotation: -180,
    hueRange: 200,
    saturation: 0.54,
    brightness: 1.03,
    contrast: 0.69
  )
  .write(o1)

render(o1)