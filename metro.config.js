const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as .sql strings (see babel inline-import).
config.resolver.sourceExts.push('sql');

module.exports = config;
