const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['dark'],
});

// ponytail: uniwind 1.12.1 rewrites react-native-web's './exports/InputAccessoryView' to its own
// wrapper, which imports react-native back into react-native-web's index (circular import, blank
// web page: "Cannot read properties of undefined (reading 'default')"). Remove this once uniwind
// fixes it upstream and scripts/check-metro-web.js still passes without it.
const prev = uniwindConfig.resolver.resolveRequest;
uniwindConfig.resolver.resolveRequest = (ctx, name, platform) =>
  platform === 'web' && name === './exports/InputAccessoryView'
    ? {
        type: 'sourceFile',
        filePath: require.resolve('react-native-web/dist/exports/InputAccessoryView/index.js'),
      }
    : (prev ?? ctx.resolveRequest)(ctx, name, platform);

module.exports = uniwindConfig;
