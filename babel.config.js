module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the React Compiler (app.json experiments.reactCompiler)
    // and the worklets plugin for Reanimated 4.
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', { root: 'src' }],
      // Drizzle migrations are .sql files bundled as strings.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
