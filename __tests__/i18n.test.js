const mockButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../utils/auth', () => ({
  updateUser: jest.fn(),
  deleteAccount: jest.fn(),
  checkSecureStoreItem: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import i18next from 'i18next';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES } from '../constants/languages';
import i18n from '../i18n';
import I18nProvider, { useUiLocale } from '../store/i18n-context';
import { AuthContext } from '../store/auth-context';
import SettingsScreen from '../screens/SettingsScreen';
import { getUiLocale, saveUiLocale } from '../utils/storageDatum';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function UiLocaleProbe() {
  const { uiLocale, setUiLocale } = useUiLocale();
  return (
    <Text onPress={() => setUiLocale('de')} testID="probe.ui-locale">
      {uiLocale}
    </Text>
  );
}

describe('i18n initialization', () => {
  it('is initialized with English as default and fallback', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('en');
    expect([i18n.options.fallbackLng].flat()).toContain('en');
    expect(i18n.t('common.close')).toBe('Close');
  });

  it('translates a known key in another locale and falls back for unknown keys', () => {
    expect(i18n.t('common.close', { lng: 'id' })).toBe('Tutup');
    expect(i18n.t('totally.missing.key')).toBe('totally.missing.key');
  });
});

describe('locale files', () => {
  it('ships a JSON file with the first-wave keys for every LANGUAGES code', () => {
    for (const { code } of LANGUAGES) {
      const file = resolve(__dirname, '..', 'i18n', 'locales', `${code}.json`);
      expect(existsSync(file)).toBe(true);

      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      expect(typeof parsed.common?.selectLanguage).toBe('string');
      expect(typeof parsed.common?.close).toBe('string');
      expect(typeof parsed.settings?.title).toBe('string');
    }
  });

  it('registers a translation bundle for every LANGUAGES code', () => {
    for (const { code } of LANGUAGES) {
      expect(i18n.hasResourceBundle(code, 'translation')).toBe(true);
    }
  });

  it('keeps every non-en locale key set a subset of the en key set', () => {
    function flattenKeys(bundle, prefix = '') {
      return Object.entries(bundle).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? flattenKeys(value, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    }

    const enFile = resolve(__dirname, '..', 'i18n', 'locales', 'en.json');
    const enKeys = new Set(flattenKeys(JSON.parse(readFileSync(enFile, 'utf8'))));

    for (const { code } of LANGUAGES) {
      if (code === 'en') {
        continue;
      }

      const file = resolve(__dirname, '..', 'i18n', 'locales', `${code}.json`);
      const keysOutsideEn = flattenKeys(JSON.parse(readFileSync(file, 'utf8'))).filter(
        (key) => !enKeys.has(key),
      );

      expect(keysOutsideEn).toEqual([]);
    }
  });
});

describe('fallback mechanics', () => {
  async function createScratchInstance() {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'id',
      fallbackLng: 'en',
      returnEmptyString: false,
      resources: {
        en: {
          translation: {
            fallback: { onlyInEn: 'English value', emptyInId: 'English fallback' },
          },
        },
        id: {
          translation: {
            fallback: { emptyInId: '' },
          },
        },
      },
    });
    return instance;
  }

  it('returns the en value when the key is missing from the active locale', async () => {
    const instance = await createScratchInstance();

    expect(instance.t('fallback.onlyInEn')).toBe('English value');
  });

  it('falls through an empty-string active-locale value to the en value (returnEmptyString: false)', async () => {
    const instance = await createScratchInstance();

    expect(instance.t('fallback.emptyInId')).toBe('English fallback');
  });
});

describe('storageDatum uiLocale', () => {
  afterEach(() => {
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
  });

  it('returns null when unset', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await expect(getUiLocale()).resolves.toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('uiLocale');
  });

  it('round-trips a saved ui locale through the uiLocale key', async () => {
    await saveUiLocale('fr');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('uiLocale', 'fr');

    AsyncStorage.getItem.mockResolvedValue('fr');
    await expect(getUiLocale()).resolves.toBe('fr');
  });
});

describe('I18nProvider', () => {
  const originalE2eMode = process.env.EXPO_PUBLIC_E2E_MODE;

  afterEach(async () => {
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2eMode;
    await i18n.changeLanguage('en');
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
  });

  it('resolves the stored uiLocale and switches languages restart-free', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === 'uiLocale' ? 'fr' : null),
    );

    let renderer;
    await act(async () => {
      renderer = create(
        <I18nProvider>
          <UiLocaleProbe />
        </I18nProvider>,
      );
      await flushPromises();
    });

    expect(renderer.root.findByProps({ testID: 'probe.ui-locale' }).props.children).toBe('fr');
    expect(i18n.language).toBe('fr');

    await act(async () => {
      renderer.root.findByProps({ testID: 'probe.ui-locale' }).props.onPress();
      await flushPromises();
    });

    expect(i18n.language).toBe('de');
    expect(renderer.root.findByProps({ testID: 'probe.ui-locale' }).props.children).toBe('de');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('uiLocale', 'de');
  });

  it('forces en in E2E mode even when another uiLocale is stored', async () => {
    process.env.EXPO_PUBLIC_E2E_MODE = 'true';
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === 'uiLocale' ? 'fr' : null),
    );

    let renderer;
    await act(async () => {
      renderer = create(
        <I18nProvider>
          <UiLocaleProbe />
        </I18nProvider>,
      );
      await flushPromises();
    });

    expect(renderer.root.findByProps({ testID: 'probe.ui-locale' }).props.children).toBe('en');
    expect(i18n.language).toBe('en');

    await act(async () => {
      renderer.root.findByProps({ testID: 'probe.ui-locale' }).props.onPress();
      await flushPromises();
    });

    expect(i18n.language).toBe('en');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('uiLocale', 'en');
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('uiLocale', 'de');
  });
});

describe('Settings App Language section', () => {
  const originalE2eMode = process.env.EXPO_PUBLIC_E2E_MODE;

  afterEach(async () => {
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2eMode;
    await i18n.changeLanguage('en');
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
  });

  it('renders the translated section, opens the selector, and persists a new ui locale', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === 'uiLocale' ? 'fr' : null),
    );

    const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{}}>
          <I18nProvider>
            <SettingsScreen navigation={navigation} />
          </I18nProvider>
        </AuthContext.Provider>,
      );
      await flushPromises();
    });

    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Paramètres' });
    expect(renderer.root.findByProps({ testID: 'settings.input.ui-locale' })).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ children: "Langue de l'application" }).length,
    ).toBeGreaterThan(0);

    const trigger = renderer.root.findByProps({
      testID: 'settings.input.ui-locale.selector.button',
    });
    expect(trigger.findByType(Text).props.children).toBe('Français');

    await act(async () => {
      trigger.props.onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'settings.input.ui-locale.selector.option.id' }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'settings.input.ui-locale.selector.close' }),
    ).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ children: 'Sélectionner la langue' }).length,
    ).toBeGreaterThan(0);

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'settings.input.ui-locale.selector.option.de' })
        .props.onPress();
      await flushPromises();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('uiLocale', 'de');
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Einstellungen' });
  });
});
