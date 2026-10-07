// expo-media-library añade READ/WRITE_EXTERNAL_STORAGE al manifest sin límite de versión.
// No se pueden bloquear: en Android 12 o menor saveToLibraryAsync exige WRITE_EXTERNAL_STORAGE
// (y image-crop-picker también en Android 10 o menor). Con maxSdkVersion 32 solo existen
// donde hacen falta y desaparecen en Android 13+. image-crop-picker declara 29 y el merger
// falla con valores distintos, así que el nuestro lleva tools:replace para ganar (32 incluye a 29).
const { withAndroidManifest } = require('expo/config-plugins');

const LEGACY_STORAGE = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    manifest['uses-permission'] = [
      ...(manifest['uses-permission'] ?? []).filter(
        (p) => !LEGACY_STORAGE.includes(p.$['android:name']),
      ),
      ...LEGACY_STORAGE.map((name) => ({
        $: {
          'android:name': name,
          'android:maxSdkVersion': '32',
          'tools:replace': 'android:maxSdkVersion',
        },
      })),
    ];
    return config;
  });
