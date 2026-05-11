const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'roslib': path.resolve(__dirname, 'node_modules/roslib/build/roslib.js'),
};

config.resolver.sourceExts.push('cjs');
config.resolver.assetExts.push('glb', 'gltf', 'obj', 'mtl', 'jpg', 'jpeg');

// ── Fix: three.js package.json has invalid `exports` entries for examples/jsm
// Metro falls back to file-based resolution automatically but logs a WARN for
// every import. Intercept those paths and resolve them directly with .js so
// Metro never touches the broken exports map entries.
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('three/examples/jsm/') && !moduleName.endsWith('.js')) {
    return (originalResolve ?? context.resolveRequest)(context, moduleName + '.js', platform);
  }
  if (originalResolve) return originalResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;