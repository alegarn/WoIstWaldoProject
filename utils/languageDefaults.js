import { LANGUAGES } from '../constants/languages';

const SUPPORTED_LOCALES = LANGUAGES.map((language) => language.code);
const DEFAULT_LOCALE = 'en';

export function resolveDefaultLanguage() {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE).split('-')[0];
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function isSupportedLocale(code) {
  return SUPPORTED_LOCALES.includes(code);
}

/**
 * Resolve the UI locale (app interface language — DISTINCT from the
 * preferredLanguage enigma-content concept): a supported stored `uiLocale`
 * wins, otherwise the device locale (Hermes Intl, NO native localization
 * module), otherwise 'en'. Unsupported stored/device codes fall through
 * rather than crash i18next resource lookup.
 * @param {string|null|undefined} storedUiLocale - Persisted uiLocale, if any.
 * @returns {string} Supported locale code.
 */
export function resolveUiLocale(storedUiLocale) {
  if (isSupportedLocale(storedUiLocale)) {
    return storedUiLocale;
  }

  const deviceLocale = resolveDefaultLanguage();
  return isSupportedLocale(deviceLocale) ? deviceLocale : DEFAULT_LOCALE;
}
