// Shared chromium launch args for every rendered gate and consumer driver.
//
// darwin: real ANGLE/Metal (the platform's measured hardware path).
// Other platforms (Linux CI, Windows hosted runners): the explicit software
// ANGLE/SwiftShader path. Linux headless chromium already falls back to
// SwiftShader, so this changes nothing there; on Windows it avoids the
// virtualized D3D11/GPU-driver path that correlates with five hosted-runner
// losses (runs 36376821131, 36386857021, 36393024796, 36400228289,
// 36422741592 — same renderer stack that already renders byte-exact on the
// Linux legs). This is a rendering-path selection, not a tolerance change:
// every gate still enforces its published thresholds.
export function chromiumLaunchArgs () {
  const args = ['--disable-gpu-sandbox']
  if (process.platform === 'darwin') {
    args.push('--use-angle=metal')
  } else {
    args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader')
  }
  return args
}
