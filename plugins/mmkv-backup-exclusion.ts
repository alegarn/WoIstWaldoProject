/**
 * Local Expo config plugin: excludes the MMKV root directory from iCloud/iTunes
 * backups on iOS by setting NSURLIsExcludedFromBackupKey on <Documents>/mmkv.
 *
 * WHY: AsyncStorage excluded its data from device backups on both platforms
 * (NSURLIsExcludedFromBackupKey in RNCAsyncStorage.mm; Android via the
 * secure-store include-only backup rules). The MMKV swap must preserve that
 * no-backup semantics: an iCloud restore carrying a stale MMKV snapshot with
 * mmkv_migrated=true would silently serve outdated decks. Uninstall/reinstall
 * already loses decks today, so excluding the directory keeps parity.
 *
 * HOW: android/ and ios/ are gitignored — EAS regenerates natives via
 * `expo prebuild`, so this plugin edits the generated AppDelegate.swift at
 * prebuild time. It creates <Documents>/mmkv (if missing) and flags it
 * excluded BEFORE MMKV initializes, and the exclusion applies recursively to
 * everything MMKV later writes inside it. Android needs nothing — the existing
 * include-only backup rules already exclude the MMKV files.
 *
 * Mirror of plugins/edge-to-edge-play-warning.js (same prebuild-mod pattern).
 */

import type { ExpoConfig } from '@expo/config-types';
import { withAppDelegate, type ConfigPlugin } from 'expo/config-plugins';

const MARKER = 'mmkv-backup-exclusion';
const MMKV_DIR_NAME = 'mmkv';

function backupExclusionSnippet(): string {
  return [
    `// ${MARKER}: keep MMKV out of iCloud/iTunes backups, matching`,
    '// AsyncStorage\'s no-backup semantics (see plugins/mmkv-backup-exclusion.js).',
    'if let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {',
    `  let mmkvRoot = documentsUrl.appendingPathComponent("${MMKV_DIR_NAME}")`,
    '  try? FileManager.default.createDirectory(at: mmkvRoot, withIntermediateDirectories: true)',
    '  try? (mmkvRoot as NSURL).setResourceValue(true, forKey: .isExcludedFromBackupKey)',
    '}',
  ].join('\n');
}

const withMmkvBackupExclusion: ConfigPlugin = (config) =>
  withAppDelegate(config, (modConfig) => {
    if (modConfig.modResults.language !== 'swift') {
      throw new Error(
        'mmkv-backup-exclusion: expected the iOS AppDelegate to be Swift.'
      );
    }

    const contents = modConfig.modResults.contents;
    if (contents.includes(MARKER)) {
      return modConfig;
    }

    const anchor = contents.indexOf('didFinishLaunchingWithOptions');
    if (anchor === -1) {
      throw new Error(
        'mmkv-backup-exclusion: could not find "didFinishLaunchingWithOptions" in the iOS AppDelegate.'
      );
    }

    const brace = contents.indexOf('{', anchor);
    if (brace === -1) {
      throw new Error(
        'mmkv-backup-exclusion: could not find the body of "didFinishLaunchingWithOptions" in the iOS AppDelegate.'
      );
    }

    modConfig.modResults.contents =
      contents.slice(0, brace + 1) +
      '\n' +
      backupExclusionSnippet() +
      contents.slice(brace + 1);

    return modConfig;
  });

export default function mmkvBackupExclusionPlugin(
  config: ExpoConfig
): ExpoConfig {
  return withMmkvBackupExclusion(config);
}
