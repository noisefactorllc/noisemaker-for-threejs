search synth, filter, classicNoisedeck, render, points, mixer

gabor(
  scale: 89.31,
  orientation: 62.63,
  bandwidth: 27.48,
  isotropy: 70.82,
  density: 8,
  octaves: 4,
  speed: 2,
  seed: 38
)
  .ridge(level: 0.52)
  .lowPoly(
    scale: 87,
    seed: 55,
    mode: distance2,
    edgeStrength: 0.57,
    alpha: 0.3,
    speed: 1
  )
  .write(o0)

cell(
  scale: 62.68,
  cellScale: 57.22,
  cellSmooth: 78.06,
  variation: 100
)
  .blur(_skip: true)
  .coalesce(
    tex: read(o0),
    blendMode: lighten,
    mix: 24.92,
    refractBDir: -180
  )
  .invert()
  .lighting(
    normalStrength: 5,
    smoothing: 2.5,
    specularIntensity: 0.27,
    shininess: 94,
    reflection: 15.6,
    refraction: 13.3,
    aberration: 50.5
  )
  .write(o1)

render(o1)