search synth, filter, render, points, mixer

perlin(scale: 38.37, octaves: 2)
  .seamless(blend: 0.2, repeat: 1)
  .adjust(
    mode: hsv,
    rotation: 120,
    hueRange: 40
  )
  .subchain(name: "flow field particles", id: "8hbt") {
    .pointsEmit(stateSize: x128)
    .flock(separation: 1.8)
    .flow(behavior: unruly, stride: 57)
    .pointsRender(intensity: 90, inputIntensity: 25)
  }
  .write(o0)

render(o0)