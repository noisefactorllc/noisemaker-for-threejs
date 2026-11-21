// Capture accounting for parity/timeseries.mjs.
//
// The page captures after every `capture`-th frame (parity/page-timeseries.html:
// `(i + 1) % captureEvery === 0`), so a case of `frames` frames captures
// floor(frames / capture) of them. A case that captures nothing, or a run that
// returns another number of captures, has nothing comparable and must fail.

export function expectedCaptures (frames, capture) {
  if (!Number.isInteger(frames) || !Number.isInteger(capture) || frames < 1 || capture < 1) return 0
  return Math.floor(frames / capture)
}

// Why a case's captures cannot be compared, or null when they can.
export function captureMismatch (expected, golden, candidate) {
  if (expected < 1) return 'the case captures no frame'
  if (golden.length !== expected || candidate.length !== expected) {
    return `expected ${expected} captures, golden returned ${golden.length}, candidate ${candidate.length}`
  }
  return null
}

// A capture passes only when parity/compare.py exits 0 and prints its [PASS]
// verdict with a measured max-abs-diff for this capture's own label. An exit 0
// with no verdict (a stand-in interpreter, or nothing compared) fails.
export function samplePassed (status, output, label) {
  if (status !== 0) return false
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\[PASS\\] ${escaped}: max-abs-diff=[0-9]+(?:\\.[0-9]+)? `, 'm').test(String(output ?? ''))
}
