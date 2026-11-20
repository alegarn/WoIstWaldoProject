import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n';
import { isE2EMode } from '../utils/e2eMode';
import { resolveUiLocale } from '../utils/languageDefaults';
import { getUiLocale, saveUiLocale } from '../utils/storageDatum';

const UiLocaleContext = createContext({
  uiLocale: 'en',
  setUiLocale: () => {},
});

export function useUiLocale() {
  return useContext(UiLocaleContext);
}

function pinnedUiLocale(code) {
  return isE2EMode() ? 'en' : code;
}

async function readStoredUiLocale() {
  try {
    return await getUiLocale();
  } catch {
    return null;
  }
}

/**
 * App-wide UI locale provider. Wraps react-i18next's I18nextProvider and adds:
 * - boot resolution (stored uiLocale > device locale > 'en') applied via
 *   i18n.changeLanguage so switching is restart-free;
 * - an E2E pin: isE2EMode() forces 'en' so Maestro flows keep English copy.
 * The UI locale is a NEW concept — it never touches preferredLanguage
 * (enigma content) or sessionLanguageFilter.
 */
export default function I18nProvider({ children }) {
  const [uiLocale, setUiLocaleState] = useState('en');

  useEffect(() => {
    let mounted = true;

    (async () => {
      const stored = await readStoredUiLocale();
      const next = pinnedUiLocale(resolveUiLocale(stored));

      if (!mounted) {
        return;
      }

      setUiLocaleState(next);
      if (i18n.language !== next) {
        await i18n.changeLanguage(next);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setUiLocale = useCallback(async (code) => {
    const next = pinnedUiLocale(code);

    setUiLocaleState(next);
    await i18n.changeLanguage(next);
    await saveUiLocale(next).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ uiLocale, setUiLocale }),
    [uiLocale, setUiLocale],
  );

  return (
    <I18nextProvider i18n={i18n}>
      <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
    </I18nextProvider>
  );
}
