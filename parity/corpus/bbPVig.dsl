search classicNoisedeck, synth, filter

noise(
  type: catmullRom3x3,
  octaves: 1,
  xScale: 98,
  yScale: 98,
  ridges: true,
  wrap: false,
  refractAmt: 100,
  speed: 19,
  kaleido: 11,
  hueRotation: 70,
  hueRange: 23
)
  .write(o0)

noise(
  type: catmullRom3x3,
  octaves: 1,
  xScale: 98,
  yScale: 98,
  ridges: true,
  wrap: false,
  refractAmt: 100,
  speed: 21,
  kaleido: 3,
  hueRotation: 65,
  hueRange: 46
)
  .coalesce(
    tex: read(o0),
    blendMode: multiply,
    mix: 55,
    refractAAmt: 100,
    refractBAmt: 8.98
  )
  .lensDistortion(
    distortion: -49,
    loopScale: 60,
    aberration: 16,
    tint: #4986bcff,
    alpha: 11,
    vignetteAmt: -100
  )
  .write(o1)

render(o1)