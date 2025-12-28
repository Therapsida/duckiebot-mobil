// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 1. roslib paketini manuel olarak yönlendiriyoruz (Alias)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // 'roslib' çağrıldığında direkt build klasöründeki dosyaya git
  'roslib': path.resolve(__dirname, 'node_modules/roslib/build/roslib.js'),
};

// 2. Eğer gerekirse cjs uzantısını da ekle
config.resolver.sourceExts.push('cjs');

module.exports = config;