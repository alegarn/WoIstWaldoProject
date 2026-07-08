import { GlobalStyle } from '../../../constants/theme';

/**
 * Single source of truth for the GroupSettings design language.
 *
 * Every settings section derives its colors, radii, and hairlines from here so
 * the look stays coherent and can evolve by editing one file (Open/Closed:
 * extend the palette here rather than scattering hexes across components).
 */
export const settingsTokens = {
  panel: GlobalStyle.color.primaryColor800,
  inset: GlobalStyle.color.primaryColor700,
  insetDeep: GlobalStyle.color.primaryColor600,
  accent: GlobalStyle.color.primaryColor,
  accentSoft: GlobalStyle.color.secondaryColor,

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
