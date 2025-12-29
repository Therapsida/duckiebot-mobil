const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);


config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,

  'roslib': path.resolve(__dirname, 'node_modules/roslib/build/roslib.js'),
};

config.resolver.sourceExts.push('cjs');

module.exports = config;