import 'intl-pluralrules';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import id from './locales/id.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';

export const DEFAULT_UI_LOCALE = 'en';

export const UI_LOCALE_RESOURCES = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  it: { translation: it },
  pt: { translation: pt },
  ja: { translation: ja },
  zh: { translation: zh },
  id: { translation: id },
};

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: UI_LOCALE_RESOURCES,
    lng: DEFAULT_UI_LOCALE,
    fallbackLng: DEFAULT_UI_LOCALE,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18next;
