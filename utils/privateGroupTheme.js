import { GlobalStyle } from '../constants/theme';
import { generateShades, hexToRgb, normalizeHex } from './colorShades';

const LIGHT_TEXT = '#FFFFFF';
const DARK_TEXT = GlobalStyle.color.primaryColor800;

function relativeChannel(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * relativeChannel(r)) + (0.7152 * relativeChannel(g)) + (0.0722 * relativeChannel(b));
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getReadableTextColor(backgroundHex) {
  const bgLuminance = relativeLuminance(backgroundHex);
  const lightContrast = contrastRatio(bgLuminance, relativeLuminance(LIGHT_TEXT));
  const darkContrast = contrastRatio(bgLuminance, relativeLuminance(DARK_TEXT));
  return lightContrast >= darkContrast ? LIGHT_TEXT : DARK_TEXT;
}

export function getPrivateGroupTheme({ primaryColor, secondaryColor } = {}) {
  const primary = normalizeHex(primaryColor ?? GlobalStyle.color.primaryColor);
  const secondary = normalizeHex(secondaryColor ?? GlobalStyle.color.secondaryColor);
  const primaryShades = generateShades(primary, 10);
  const secondaryShades = generateShades(secondary, 10);
  const accentText = getReadableTextColor(primary);
  const lightText = primaryShades[1];

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentText,
    primaryShades,
    secondaryShades,

    screen: primaryShades[0],
    surface: primaryShades[1],
    inset: primaryShades[2],
    insetDeep: primaryShades[3],
    inputSurface: rgbaFromHex(primaryShades[0], 0.42),
    text: LIGHT_TEXT,
    muted: 'rgba(255,255,255,0.55)',
    mutedSoft: 'rgba(255,255,255,0.4)',
    hairline: rgbaFromHex(secondary, 0.18),
    hairlineStrong: rgbaFromHex(secondary, 0.35),
    hairlineInput: rgbaFromHex(secondary, 0.22),
    accentWash: rgbaFromHex(primary, 0.12),

    lightPanel: primaryShades[9],
    lightInset: '#FFFFFF',
    lightInsetDeep: primaryShades[8],
    lightText,
    lightMuted: rgbaFromHex(lightText, 0.68),
    lightMutedSoft: rgbaFromHex(lightText, 0.48),
    lightHairline: rgbaFromHex(primary, 0.12),
    lightHairlineStrong: rgbaFromHex(primary, 0.24),
    lightHairlineInput: rgbaFromHex(primary, 0.18),
    lightAccentWash: rgbaFromHex(primary, 0.12),

    warning: GlobalStyle.color.warning,
    warn: GlobalStyle.color.error500,
    danger: '#E03A3A',
    dangerSoft: 'rgba(224,58,58,0.12)',
    headerTintColor: accentText,
  };
}

export function getPrivateGroupSettingsTokens({ appearance = 'dark', primaryColor, secondaryColor } = {}) {
  const theme = getPrivateGroupTheme({ primaryColor, secondaryColor });

  if (appearance === 'light') {
    return {
      panel: theme.lightPanel,
      inset: theme.lightInset,
      insetDeep: theme.lightInsetDeep,
      accent: theme.primaryColor,
      accentText: theme.accentText,
      accentSoft: theme.secondaryColor,
      accentWash: theme.lightAccentWash,
      inputSurface: theme.lightInset,
      hairline: theme.lightHairline,
      hairlineStrong: theme.lightHairlineStrong,
      hairlineInput: theme.lightHairlineInput,
      text: theme.lightText,
      muted: theme.lightMuted,
      mutedSoft: theme.lightMutedSoft,
      danger: theme.danger,
      dangerSoft: theme.dangerSoft,
      warn: theme.warn,
      radiusPanel: 8,
      radiusCard: 12,
      radiusInput: 6,
      radiusPill: 13,
    };
  }

  return {
    panel: theme.surface,
    inset: theme.inset,
    insetDeep: theme.insetDeep,
    accent: theme.primaryColor,
    accentText: theme.accentText,
    accentSoft: theme.secondaryColor,
    accentWash: theme.accentWash,
    inputSurface: theme.inputSurface,
    hairline: theme.hairline,
    hairlineStrong: theme.hairlineStrong,
    hairlineInput: theme.hairlineInput,
    text: theme.text,
    muted: theme.muted,
    mutedSoft: theme.mutedSoft,
    danger: theme.danger,
    dangerSoft: theme.dangerSoft,
    warn: theme.warn,
    radiusPanel: 8,
    radiusCard: 12,
    radiusInput: 6,
    radiusPill: 13,
  };
}
