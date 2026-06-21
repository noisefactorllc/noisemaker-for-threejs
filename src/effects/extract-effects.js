/**
 * Determine which effect ids a DSL program needs, so we register only those.
 *
 * Namespaces come from `search` lines; candidate funcs are identifiers immediately
 * before `(`. We intersect against the vendored manifest (namespace -> [dirNames]).
 * For the parity catalog, effect func == dir name; mismatches (rare) are handled
 * per-effect if they arise.
 */
import manifest from '../vendor/effects-manifest.json' with { type: 'json' }

export function extractEffectIds(dsl) {
  const namespaces = new Set()
  for (const m of dsl.matchAll(/^[ \t]*search[ \t]+(.+)$/gm)) {
    for (const ns of m[1].split(',')) namespaces.add(ns.trim())
  }
  const funcs = new Set()
  for (const m of dsl.matchAll(/([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(/g)) funcs.add(m[1])

  const ids = []
  for (const ns of namespaces) {
    for (const name of manifest.namespaces[ns] || []) {
      if (funcs.has(name)) ids.push(`${ns}/${name}`)
    }
  }
  return ids
}
