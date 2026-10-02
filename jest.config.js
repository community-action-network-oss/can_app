const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
  // react-intl and @formatjs/* ship ESM only; let babel transform them too.
  transformIgnorePatterns: preset.transformIgnorePatterns.map((p) =>
    p.replace(
      'node_modules/(?!(',
      'node_modules/(?!(react-intl|@formatjs/.*|intl-messageformat|@gluestack-ui/.*|@legendapp/.*|uniwind|react-aria|react-stately|@react-aria/.*|@react-stately/.*|@react-types/.*|@internationalized/.*|tailwind-variants|',
    ),
  ),
};
