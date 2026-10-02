// Guard: on web, react-native-web's InputAccessoryView must resolve to its own file, not uniwind's wrapper.
const assert = require('node:assert');
const { resolver } = require('../metro.config.js');

const fail = () => assert.fail('fell through to the default resolver');
const res = resolver.resolveRequest(
  { resolveRequest: fail },
  './exports/InputAccessoryView',
  'web',
);
assert.match(
  res.filePath,
  /react-native-web[\\/]dist[\\/]exports[\\/]InputAccessoryView[\\/]index\.js$/,
);
// other platforms must still reach the chain
assert.throws(
  () => resolver.resolveRequest({ resolveRequest: fail }, './exports/InputAccessoryView', 'ios'),
  /./,
);
console.log('check-metro-web: ok');
