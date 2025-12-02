const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure @expo/vector-icons fonts are properly resolved for web
config.resolver.assetExts.push('ttf');

module.exports = config;
