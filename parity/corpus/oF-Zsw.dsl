search synth, filter

let osc1 = osc(type: oscKind.sine)

perlin(
  scale: 18.51,
  dimensions: 3,
  ridges: true,
  seed: 15,
  speed: 5
)
  .write(o0)

reactionDiffusion(
  tex: read(o0),
  zoom: x32,
  smoothing: bSpline4x4,
  speed: 21.42,
  sourceF: sliderInput,
  feed: 81.56,
  kill: 58.94,
  rate1: 60.24,
  rate2: 24.09,
  weight: 100,
  inputIntensity: 11.78
)
  .write(o1)

reactionDiffusion(
  tex: read(o1),
  smoothing: catmullRom4x4,
  speed: 21.27,
  sourceF: brightness,
  feed: 89.8,
  kill: 49.29,
  rate1: 97.32,
  rate2: 22.07,
  weight: 100,
  inputIntensity: 70.19
)
  .write(o2)

reactionDiffusion(
  tex: read(o2),
  zoom: x2,
  smoothing: bSpline4x4,
  speed: 24.79,
  sourceF: brightness,
  feed: 56.43,
  kill: 57.61,
  rate1: 81.44,
  rate2: 23.67,
  weight: 100,
  inputIntensity: 88.4
)
  .tetraColorArray(
    colorMode: oklch,
    colorCount: 8,
    color0: #59a726,
    color1: #e164b4,
    color2: #aa1eb7,
    color3: #2ef755,
    color4: #dc8740,
    color5: #b992ec,
    color6: #40a2a4,
    color7: #f9c025,
    pos0: 0.097,
    pos1: 0.099,
    pos2: 0.296,
    pos3: 0.323,
    pos4: 0.559,
    pos5: 0.776,
    pos6: 0.915,
    pos7: 0.964,
    rotation: back,
    repeat: 3.07,
    offset: 0.483,
    alpha: 0.931,
    smoothness: 0.475
  )
  .write(o3)

read(o3)
  .celShading(
    levels: 5,
    edgeThreshold: 0.56,
    edgeColor: #ff00c5
  )
  .write(o4)

render(o4)