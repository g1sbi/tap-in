const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const nodeLibs = require('node-libs-react-native');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return {
      filePath: path.resolve(__dirname, 'polyfills/ws-polyfill.js'),
      type: 'sourceFile',
    };
  }

  if (nodeLibs[moduleName]) {
    return {
      filePath: nodeLibs[moduleName],
      type: 'sourceFile',
    };
  }

  const additionalPolyfills = {
    'https': require.resolve('https-browserify'),
    'http': require.resolve('http-browserify'),
    'net': require.resolve('net-browserify'),
    'tls': require.resolve('tls-browserify'),
    'crypto': require.resolve('crypto-browserify'),
  };

  if (additionalPolyfills[moduleName]) {
    return {
      filePath: additionalPolyfills[moduleName],
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

const nodeLibsExtra = require('node-libs-react-native');
config.resolver.extraNodeModules = {
  ...nodeLibsExtra,
  https: require.resolve('https-browserify'),
  http: require.resolve('http-browserify'),
  net: require.resolve('net-browserify'),
  tls: require.resolve('tls-browserify'),
  crypto: require.resolve('crypto-browserify'),
  ws: path.resolve(__dirname, 'polyfills/ws-polyfill.js'),
};

config.resolver.blockList = [
  /node_modules\/ws\/.*/,
];

module.exports = config;

