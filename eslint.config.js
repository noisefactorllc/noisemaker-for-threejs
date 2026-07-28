// Flat config for `npm run lint` (eslint 10 requires one; the repo shipped the script without it).
// Correctness rules only — the port has no style linter and none is being introduced here.
import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // Adapter surfaces intentionally accept-and-ignore engine callback args to keep
      // signatures aligned with the reference; flag unused locals, not unused args.
      'no-unused-vars': ['error', { args: 'none' }]
    }
  },
  // src/vendor/ is a snapshot of reference engine source — lint the adapter, not the engine.
  { ignores: ['vendor/', 'src/vendor/', 'examples/bundle.js', 'examples/cubemap-bundle.js', 'node_modules/'] }
]
