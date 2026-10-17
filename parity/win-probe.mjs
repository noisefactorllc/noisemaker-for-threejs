// Minimal WebGL2 launch probe (Windows hosted-runner diagnosis, and the
// renderer record for the Firefox and Safari legs).
// The windows-2025 runner lost communication three times exactly when the
// rendered gates launch chromium; this probe isolates that launch with
// negligible runtime and prints the renderer so the step can emit it as an
// annotation readable from a read-only session. NM_BROWSER selects the browser
// as in parity/timeseries.mjs (default chromium).
import { parityBrowserConfig } from './launch-args.mjs'

const { browserType, launchOptions } = parityBrowserConfig()
const browser = await browserType.launch(launchOptions)
try {
  const page = await browser.newPage()
  const info = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { webgl2: false }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      webgl2: true,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    }
  })
  console.log(`[probe] ${JSON.stringify({ browser: browserType.name(), version: browser.version(), ...info })}`)
} finally {
  await browser.close()
}
