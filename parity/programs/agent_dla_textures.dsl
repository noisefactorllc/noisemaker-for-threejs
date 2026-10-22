search synth, filter, render, points, mixer

perlin(scale: 35, colorMode: rgb)
  .write(o1)

perlin(scale: 22, octaves: 4, colorMode: mono)
  .write(o2)

noise(scaleX: 80, scaleY: 80, seed: 5, speed: 30)
  .subchain(name: "agents", id: "agdlatex") {
    .pointsEmit()
    .dla(heightTex: read(o2), diffuseTex: read(o1))
    .pointsRender(density: 50, intensity: 80)
  }
  .write(o0)

render(o0)
