export function kitConsumerPassed(out) {
  const required = ['kit-inventory', 'engine-source', 'engine-bundles', 'valid-render', 'valid-leg-clean', 'invalid-diagnostic', 'removal']
  return out.gate.length === 0 && out.steps.every(step => step.ok === true) &&
    required.every(name => out.steps.some(step => step.name === name && step.ok === true))
}
