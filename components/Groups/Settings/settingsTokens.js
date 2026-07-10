import { getPrivateGroupSettingsTokens } from '../../../utils/privateGroupTheme';

/**
 * Single source of truth for the GroupSettings design language.
 *
 * Every settings section derives its colors, radii, and hairlines from here so
 * the look stays coherent and can evolve by editing one file (Open/Closed:
 * extend the palette here rather than scattering hexes across components).
 */
export const settingsAppearances = {
  dark: getPrivateGroupSettingsTokens({ appearance: 'dark' }),
  light: getPrivateGroupSettingsTokens({ appearance: 'light' }),
};

export const settingsTokens = settingsAppearances.dark;

export function getSettingsTokens(options = 'dark') {
  const resolved = typeof options === 'string'
    ? { appearance: options }
    : (options ?? {});

  return getPrivateGroupSettingsTokens(resolved);
}
