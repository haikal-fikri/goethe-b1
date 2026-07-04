module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated v4 lädt seinen Worklet-Babel-Plugin aus react-native-worklets.
    // MUSS als LETZTES Plugin stehen.
    plugins: ["react-native-worklets/plugin"],
  };
};
