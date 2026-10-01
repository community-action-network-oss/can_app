const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const a11y = require('eslint-plugin-react-native-a11y');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'src/api/schema.d.ts', 'src/components/ui/**'] },
  {
    plugins: { 'react-native-a11y': a11y },
    rules: { ...a11y.configs.all.rules, 'react-native-a11y/has-accessibility-hint': 'off' },
  },
  {
    // Feature code imports UI only from src/components/civic.
    files: ['app/**', 'src/**'],
    ignores: ['src/components/civic/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@gluestack-ui/*'], message: 'Use src/components/civic instead.' },
            {
              group: ['**/components/ui', '**/components/ui/*'],
              message: 'Use src/components/civic instead.',
            },
          ],
        },
      ],
    },
  },
]);
