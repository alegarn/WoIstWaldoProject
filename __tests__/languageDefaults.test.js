import { readFileSync } from 'fs';
import { resolve } from 'path';

import { resolveDefaultLanguage } from '../utils/languageDefaults';

describe('resolveDefaultLanguage', () => {
  const originalDateTimeFormat = Intl.DateTimeFormat;

  afterEach(() => {
    Intl.DateTimeFormat = originalDateTimeFormat;
    jest.restoreAllMocks();
  });

  it('splits a BCP-47 locale tag down to its primary subtag (fr-FR -> fr)', () => {
    Intl.DateTimeFormat = jest.fn(() => ({
      resolvedOptions: () => ({ locale: 'fr-FR' }),
    }));

    expect(resolveDefaultLanguage()).toBe('fr');
  });

  it('splits a BCP-47 locale tag down to its primary subtag (en-US -> en)', () => {
    Intl.DateTimeFormat = jest.fn(() => ({
      resolvedOptions: () => ({ locale: 'en-US' }),
    }));

    expect(resolveDefaultLanguage()).toBe('en');
  });

  it('falls back to "en" when Intl.DateTimeFormat throws', () => {
    Intl.DateTimeFormat = jest.fn(() => {
      throw new Error('Hermes locale lookup failed');
    });

    expect(resolveDefaultLanguage()).toBe('en');
  });

  it('falls back to "en" when resolvedOptions returns an empty locale', () => {
    Intl.DateTimeFormat = jest.fn(() => ({
      resolvedOptions: () => ({ locale: '' }),
    }));

    expect(resolveDefaultLanguage()).toBe('en');
  });

  it('does not import any native localization module', () => {
    const sourcePath = resolve(__dirname, '..', 'utils', 'languageDefaults.js');
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/expo-localization/);
    expect(source).not.toMatch(/react-native-localize/);
  });
});
