search synth, filter, render, points, mixer

let osc1 = osc(type: oscKind.sawInv)

noise(
  type: catmullRom3x3,
  octaves: 8,
  scaleX: 100,
  scaleY: 100,
  seed: 64,
  ridges: true,
  loopOffset: verticalScan,
  loopScale: 100,
  speed: -53
)
  .adjust(
    mode: hsv,
    rotation: 58.32,
    hueRange: 200
  )
  .tetraColorArray(
    colorCount: 4,
    color0: #9d90f2,
    color1: #efe293,
    color2: #3b30d1,
    color3: #b40853,
    color4: #9ce487,
    color5: #7558a4,
    color6: #a68b46,
    color7: #2ec613,
    repeat: 10,
    offset: 0.796,
    alpha: 0.3
  )
  .subchain(name: "feedback loop with warp", id: "mzaf") {
    .loopBegin(alpha: 100, intensity: 98)
    .warp(
      strength: 4.09,
      scale: 3.19,
      seed: 28,
      speed: 1
    )
    .feedback(
      mix: 90.74,
      refractAAmt: 4.23,
      refractBAmt: 2.74,
      refractADir: 144.32,
      refractBDir: 32.17
    )
    .loopEnd()
  }
  .lighting(
    normalStrength: 5,
    smoothing: 4,
    reflection: 39.2,
    refraction: 45.7,
    aberration: 25.1
  )
  .prismaticAberration(
    aberration: 100,
    modulate: true,
    hueRange: 100,
    saturation: -77.93,
    passthru: 47.64
  )
  .adjust(
    rotation: osc1,
    hueRange: 200,
    saturation: 1.29,
    brightness: 0.89,
    contrast: 0.85
  )
  .smooth(threshold: 0)
  .write(o0)

render(o0)