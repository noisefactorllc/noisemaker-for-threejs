search mixer, synth, filter

cell(
  scale: 87.83,
  cellScale: 100,
  cellSmooth: 100,
  variation: 100,
  seed: 41
)
  .palette(
    index: grayscale,
    rotation: fwd,
    alpha: 0.29
  )
  .write(o0)

noise(
  type: catmullRom3x3,
  octaves: 1,
  scaleX: 100,
  scaleY: 100,
  seed: 36,
  ridges: true,
  loopOffset: horizontalScan,
  loopScale: 76.35,
  speed: 15,
  colorMode: mono
)
  .tetraCosine(
    colorMode: oklch,
    offsetR: 0.814,
    offsetG: 0.572,
    offsetB: 0.229,
    ampR: 0.731,
    ampG: 0.638,
    ampB: 0.727,
    freqG: 3,
    freqB: 4,
    phaseR: 0.855,
    phaseG: 0.469,
    phaseB: 0.065,
    rotation: fwd,
    repeat: 5,
    offset: 0.83,
    alpha: 0.955
  )
  .distortion(
    tex: read(o0),
    mode: reflect,
    intensity: 36.31,
    wrap: clamp,
    smoothing: 33.63,
    aberration: 2.51,
    antialias: true
  )
  .lighting(normalStrength: 0.73, smoothing: 3.6)
  .write(o1)

render(o1)