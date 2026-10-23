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
//
// NM_PARITY_GPU=vulkan opts a host into hardware ANGLE/Vulkan: the browser
// then runs headed on the host's X display (xvfb-run qualifies) and renders
// through ANGLE's Vulkan backend, so the gates measure the host GPU. The
// headless software path stays the default everywhere else.
import { chromium, firefox } from '@playwright/test'
import { CONSOLE_RECORDER, safari } from './safari-webdriver.mjs'

export function chromiumLaunchArgs () {
  const args = ['--disable-gpu-sandbox']
  if (process.env.NM_PARITY_GPU === 'vulkan') {
    args.push('--no-sandbox', '--ozone-platform=x11', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist')
    return args
  }
  if (process.platform === 'darwin') {
    args.push('--use-angle=metal')
  } else {
    args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader')
  }
  return args
}

// The vulkan path needs a real display: the NVIDIA Vulkan driver exposes no
// headless surface, so a headless browser cannot start its context there.
export function parityHeadless () {
  return process.env.NM_PARITY_GPU !== 'vulkan'
}

// The pinned playwright-core revision resolves its browser executable from
// browsers.json. A host that provisions a different headless-shell revision
// (a cache pruned to other revisions) can name its executable through
// NM_PARITY_BROWSER_EXECUTABLE; the launch path is otherwise unchanged.
function parityChromiumLaunchOptions () {
  const options = { headless: parityHeadless(), args: chromiumLaunchArgs(), timeout: 120000 }
  if (process.env.NM_PARITY_BROWSER_EXECUTABLE) options.executablePath = process.env.NM_PARITY_BROWSER_EXECUTABLE
  return options
}

export function parityBrowserConfig (name = process.env.NM_BROWSER || 'chromium') {
  if (name === 'chromium') {
    return {
      browserType: chromium,
      launchOptions: parityChromiumLaunchOptions(),
    }
  }
  if (name === 'firefox') {
    return { browserType: firefox, launchOptions: { headless: true, timeout: 120000 } }
  }
  // Real Safari through safaridriver (parity/safari-webdriver.mjs). Safari has
  // no headless mode, and WebDriver has no console channel, so the harness
  // injects pageInitScript into the served page to record console output.
  if (name === 'safari') {
    return { browserType: safari, launchOptions: { timeout: 120000 }, pageInitScript: CONSOLE_RECORDER }
  }
  throw new Error(`Unsupported NM_BROWSER: ${name}. Use chromium, firefox or safari.`)
}
