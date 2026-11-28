import assert from 'node:assert/strict'
import test from 'node:test'
import { kitConsumerPassed } from '../parity/kit-consumer-verdict.mjs'

const success = () => ({
  steps: ['kit-inventory', 'engine-source', 'engine-bundles', 'valid-render', 'valid-leg-clean', 'invalid-diagnostic', 'removal']
    .map(name => ({ name, ok: true })),
  gate: [],
})

test('a complete consumer run passes, while any recorded failure remains a failure', () => {
  assert.equal(kitConsumerPassed(success()), true)
  const failed = success()
  failed.gate.push('driver error: navigation timed out')
  assert.equal(kitConsumerPassed(failed), false)
})

test('each consumer leg is required even when preceding setup and removal passed', () => {
  for (const { name } of success().steps) {
    const incomplete = success()
    incomplete.steps = incomplete.steps.filter(step => step.name !== name)
    assert.equal(kitConsumerPassed(incomplete), false, name)
    const failed = success()
    failed.steps.find(step => step.name === name).ok = false
    assert.equal(kitConsumerPassed(failed), false, name)
  }
})
