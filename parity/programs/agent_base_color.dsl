search synth, filter, render, points, mixer

perlin(scale: 35, colorMode: rgb)
  .write(o1)

noise(scaleX: 80, scaleY: 80, seed: 5, speed: 30)
  .subchain(name: "agents", id: "agbasecolor") {
    .pointsEmit(stateSize: () => 128)
    .physarum(diffuseTex: read(o1))
    .pointsRender(density: 50, intensity: 80)
  }
  .write(o0)

render(o0)
