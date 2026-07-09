import { GlobalStyle } from '../../../constants/theme';

/**
 * Single source of truth for the GroupSettings design language.
 *
 * Every settings section derives its colors, radii, and hairlines from here so
 * the look stays coherent and can evolve by editing one file (Open/Closed:
 * extend the palette here rather than scattering hexes across components).
 */
const darkSettingsTokens = {
  panel: GlobalStyle.color.primaryColor800,
  inset: GlobalStyle.color.primaryColor700,
  insetDeep: GlobalStyle.color.primaryColor600,
  accent: GlobalStyle.color.primaryColor,
  accentText: '#fff',
  accentSoft: GlobalStyle.color.secondaryColor,
  inputSurface: 'rgba(1,0,0,0.18)',

  hairline: 'rgba(160,118,249,0.18)',
  hairlineStrong: 'rgba(160,118,249,0.35)',
  hairlineInput: 'rgba(160,118,249,0.22)',

  text: '#fff',
  muted: 'rgba(255,255,255,0.55)',
  mutedSoft: 'rgba(255,255,255,0.4)',

  danger: '#E03A3A',
  dangerSoft: 'rgba(224,58,58,0.12)',
  warn: '#F37C13',

  radiusPanel: 8,
  radiusCard: 12,
  radiusInput: 6,
  radiusPill: 13,
};

const lightSettingsTokens = {
  ...darkSettingsTokens,
  panel: '#F5F2FC',
  inset: '#FFFFFF',
  insetDeep: '#EFEAFC',
  text: GlobalStyle.color.primaryColor800,
  muted: '#6B6680',
  mutedSoft: '#958FA8',
  hairline: 'rgba(101,40,247,0.12)',
  hairlineStrong: 'rgba(101,40,247,0.24)',
  hairlineInput: 'rgba(101,40,247,0.18)',
  inputSurface: '#FFFFFF',
};

export const settingsAppearances = {
  dark: darkSettingsTokens,
  light: lightSettingsTokens,
};

export const settingsTokens = darkSettingsTokens;

export function getSettingsTokens(appearance = 'dark') {
  return settingsAppearances[appearance] ?? settingsTokens;
}
