import { readFileSync } from 'node:fs'

// Only these historical fixtures may be retired by a current engine refresh.
const retiredEffects = new Set(['bc', 'hs', 'colorspace'])

export function currentPrograms(names, manifest = JSON.parse(readFileSync(new URL('../vendor/noisemaker/effects/manifest.json', import.meta.url), 'utf8')), report = console.error) {
  return names.filter(name => {
    if (!retiredEffects.has(name) || Object.hasOwn(manifest, `filter/${name}`)) return true
    report(`[RETIRED] ${name}: filter/${name} is absent from the current engine`)
    return false
  })
}
