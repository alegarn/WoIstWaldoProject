/**
 * Local Expo config plugin: clears the Google Play "deprecated edge-to-edge
 * APIs (Android 15)" static-scan warning in EAS builds.
 *
 * WHY: android/ and ios/ are gitignored — EAS (eas.json production profile)
 * regenerates natives via `expo prebuild`, so manual edits to the local
 * android/ folder never reach the store artifact. This plugin re-applies the
 * two fixes at prebuild time:
 *   1. Forces com.google.android.material:material 1.14.0 into
 *      android/app/build.gradle. Material 1.13.0 (pulled transitively by
 *      react-native-screens and @expo/log-box) calls deprecated
 *      edge-to-edge APIs guarded behind SDK_INT < 35; 1.14.0 (material-
 *      components commit c2051db2) removes them.
 *   2. Strips android:statusBarColor / android:navigationBarColor items from
 *      the AppTheme style — the Expo template regenerates them (transparent
 *      bar colors) and Play's scan flags them.
 *
 * Re-check runbook: docs/native-code-maintenance.md
 */

const { withAppBuildGradle, withAndroidStyles } = require('@expo/config-plugins');

const MATERIAL_LINE = 'implementation("com.google.android.material:material:1.14.0")';
const MATERIAL_COMMENT =
  '// Force Material 1.14.0 — guards deprecated edge-to-edge APIs (SDK_INT < 35); clears Play Console Android-15 warning. See docs/native-code-maintenance.md.';
const MATERIAL_DEPENDENCY_PATTERN =
  /com\.google\.android\.material:material:(?:1\.(?:1[4-9]|[2-9]\d+)|[2-9]\d*\.)/;

function withMaterialVersion(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error(
        'edge-to-edge-play-warning: expected android/app/build.gradle to be Groovy.'
      );
    }

    const contents = modConfig.modResults.contents;
    if (MATERIAL_DEPENDENCY_PATTERN.test(contents)) {
      return modConfig;
    }

    const dependenciesBlock = 'dependencies {';
    const insertAt = contents.indexOf(dependenciesBlock);
    if (insertAt === -1) {
      throw new Error(
        'edge-to-edge-play-warning: could not find "dependencies {" in android/app/build.gradle.'
      );
    }

    const afterBrace = insertAt + dependenciesBlock.length;
    modConfig.modResults.contents =
      contents.slice(0, afterBrace) +
      '\n' +
      '    ' +
      MATERIAL_COMMENT +
      '\n' +
      '    ' +
      MATERIAL_LINE +
      contents.slice(afterBrace);

    return modConfig;
  });
}

const BAR_COLOR_ITEM_NAMES = new Set([
  'android:statusBarColor',
  'android:navigationBarColor',
]);

function withEdgeToEdgeStyleCleanup(config) {
  return withAndroidStyles(config, (modConfig) => {
    const styles = modConfig.modResults.resources.style || [];
    for (const style of styles) {
      if (style.$.name !== 'AppTheme' || !Array.isArray(style.items)) {
        continue;
      }
      style.items = style.items.filter((item) => {
        if (!item.$ || !item.$.name) return false;
        return !BAR_COLOR_ITEM_NAMES.has(item.$.name);
      });
    }
    return modConfig;
  });
}

module.exports = function edgeToEdgePlayWarningPlugin(config) {
  return withEdgeToEdgeStyleCleanup(withMaterialVersion(config));
};
