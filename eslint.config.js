const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: ['dist/**', 'node_modules/**', '.expo/**', 'android/**', 'ios/**', '.agents/**', '.kiro/**', '.claude/**'],
  },
  {
    // Jest conventions that the app-code rules forbid: `jest.mock` factories and
    // `jest.isolateModules` need `require`, `jest.mock` must precede the imports it
    // affects, and the PostHog test drives its env key by name.
    files: ['**/__tests__/**', 'test/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
      'expo/no-dynamic-env-var': 'off',
    },
  },
]);
