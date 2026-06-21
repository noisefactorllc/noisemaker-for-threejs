search filter, points, render, synth

mnca(
  tex: read(none),
  zoom: x32,
  smoothing: bSpline3x3,
  speed: 74.224,
  n1v1: 81.548,
  n1r1: 43.249,
  n1v2: 34.683,
  n1r2: 71.359,
  n1v3: 81.671,
  n1r3: 29.139,
  n1v4: 77.58,
  n1r4: 4.411,
  n2v1: 31.857,
  n2r1: 37.176,
  n2v2: 94.204,
  n2r2: 53.613
)
  .tetraColorArray(
    colorCount: 3,
    color0: #9a4372,
    color1: #421c14,
    color2: #af45d5,
    color3: #62e41c,
    color4: #53dd1f,
    color5: #578569,
    color6: #92fe4f,
    color7: #ccd78b,
    rotation: back,
    repeat: 4,
    offset: 0.556,
    alpha: 0.694,
    smoothness: 0.122
  )
  .subchain(name: "hydraulic", id: "jwio") {
    .pointsEmit(
      stateSize: x128,
      layout: spiral,
      seed: 58,
      attrition: 9.168
    )
    .hydraulic(stride: 545.423, inputWeight: 22.194)
    .pointsRender(
      density: 13.482,
      intensity: 22.63,
      inputIntensity: 2.534,
      rotateX: 0.891,
      rotateY: 6.085,
      rotateZ: 2.061,
      viewScale: 6.833,
      posX: 25.12,
      posY: -4.686,
      matteOpacity: 0.822
    )
  }
  .spookyTicker(
    rows: 3,
    seed: 44,
    alpha: 0.205,
    speed: 0.931
  )
  .glyphMap(
    cellSize: 15,
    seed: 57,
    colorMode: mono
  )
  .write(o0)

render(o0)