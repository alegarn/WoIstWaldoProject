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

jest.mock('../utils/localStore', () => require('./helpers/localStoreMock'));

import React from 'react';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import i18next from 'i18next';

import AsyncStorage from '../utils/localStore';
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

  it('ships the graded-reveal outcome strings for every LANGUAGES code', () => {
    for (const { code } of LANGUAGES) {
      const file = resolve(__dirname, '..', 'i18n', 'locales', `${code}.json`);
      const parsed = JSON.parse(readFileSync(file, 'utf8'));

      for (const key of ['traceWin', 'traceLoseScore', 'traceLoseLengthCap']) {
        expect(typeof parsed.game?.picture?.[key]).toBe('string');
        expect(parsed.game.picture[key].length).toBeGreaterThan(0);
      }
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

describe('private groups intro billing copy guard', () => {
  function readLocale(code) {
    return JSON.parse(readFileSync(resolve(__dirname, '..', 'i18n', 'locales', `${code}.json`), 'utf8'));
  }

  function getValue(bundle, path) {
    return path.split('.').reduce((node, segment) => (node === undefined || node === null ? undefined : node[segment]), bundle);
  }

  function flattenEntries(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === 'object' && child !== null
        ? flattenEntries(child, `${prefix}${key}.`)
        : [[`${prefix}${key}`, child]],
    );
  }

  const GROUPS_INTRO_KEYS = ['title', 'body', 'iconPointer', 'ctaOpen', 'ctaLater', 'iconLabel'];
  const GROUPS_TUTORIAL_KEYS = [
    'title',
    'skip',
    'next',
    'done',
    'page1.title',
    'page1.body',
    'page2.title',
    'page2.body',
    'page3.title',
    'page3.body',
    'page4.title',
    'page4.body',
    'storeLink',
  ];
  const GROUPS_EMPTY_KEYS = [
    'title',
    'subtitle',
    'detailCreate',
    'detailJoin',
    'storeLink',
    'storeCaption',
    'whyTitle',
    'whyBody',
  ];

  it('pins the exact groupsIntro / groupsTutorial / groups.empty key sets in en.json', () => {
    const en = readLocale('en');

    expect(Object.keys(getValue(en, 'groupsIntro') ?? {}).sort()).toEqual(GROUPS_INTRO_KEYS.slice().sort());
    expect(flattenEntries(getValue(en, 'groupsTutorial') ?? {}).map(([key]) => key).sort()).toEqual(
      GROUPS_TUTORIAL_KEYS.slice().sort(),
    );
    expect(flattenEntries(getValue(en, 'groups.empty') ?? {}).map(([key]) => key).sort()).toEqual(
      GROUPS_EMPTY_KEYS.slice().sort(),
    );
  });

  it('never says "unlock" in groupsIntro / groupsTutorial / groups.empty copy (creation is free, ADR 0016)', () => {
    const en = readLocale('en');

    for (const [block, keys] of [
      ['groupsIntro', GROUPS_INTRO_KEYS],
      ['groupsTutorial', GROUPS_TUTORIAL_KEYS],
      ['groups.empty', GROUPS_EMPTY_KEYS],
    ]) {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        const value = getValue(en, block === 'groups.empty' ? `groups.empty.${key}` : `${block}.${key}`);
        expect(typeof value).toBe('string');
        expect(value).not.toMatch(/unlock/i);
      }
    }
  });

  it('pitches creation as free in the create-related copy', () => {
    const en = readLocale('en');

    for (const key of [
      'groups.empty.detailCreate',
      'groupsTutorial.page3.title',
      'groupsTutorial.page3.body',
    ]) {
      const value = getValue(en, key);
      expect(typeof value).toBe('string');
      expect(value).toMatch(/free/i);
    }
  });

  it('ships groups.list.backToGroups in every locale', () => {
    for (const { code } of LANGUAGES) {
      const parsed = readLocale(code);
      expect(typeof parsed.groups?.list?.backToGroups).toBe('string');
      expect(parsed.groups.list.backToGroups.length).toBeGreaterThan(0);
    }
  });

  it('no longer defines groups.menu.groups in any locale', () => {
    for (const { code } of LANGUAGES) {
      const parsed = readLocale(code);
      expect(parsed.groups?.menu?.groups).toBeUndefined();
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
  let renderer;

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer.unmount();
      });
      renderer = null;
    }
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2eMode;
    await i18n.changeLanguage('en');
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
  });

  it('resolves the stored uiLocale and switches languages restart-free', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === 'uiLocale' ? 'fr' : null),
    );

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
  let renderer;

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer.unmount();
      });
      renderer = null;
    }
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
