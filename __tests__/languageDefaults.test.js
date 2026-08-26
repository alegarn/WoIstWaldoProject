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

describe('guess screens language namespace', () => {
  function readStringConstant(relativePath, name) {
    const sourcePath = resolve(__dirname, '..', ...relativePath.split('/'));
    const source = readFileSync(sourcePath, 'utf8');
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*'([^']+)'`));

    expect(match).toBeDefined();
    return match[1];
  }

  it("feed-screen default language === path-screen navigation fallback ('any')", () => {
    const feedDefault = readStringConstant(
      'screens/GuessScreens/GuessFeedScreen.js',
      'DEFAULT_LANGUAGE'
    );
    const pathFallback = readStringConstant(
      'screens/GuessScreens/GuessPathScreen.js',
      'NAVIGATION_ANY_LANGUAGE'
    );

    expect(feedDefault).toBe('any');
    expect(pathFallback).toBe('any');
    expect(feedDefault).toBe(pathFallback);
  });
});
