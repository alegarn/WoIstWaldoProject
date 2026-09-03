# WoIstWaldoProject — React Native App

## Purpose

- Govern work inside the Expo/React Native mobile app.
- Keep app-level architecture, verification, and folder ownership clear without adding child docs for every source folder.

## Ownership

- Owns mobile source, app config, native project files, Jest tests, fixtures, and patch-package patches inside this repo.
- `.maestro/` has its own child AGENTS file because E2E flows have separate runtime rules.

## Local Contracts

- Stack: Expo SDK 56, React Native 0.85.3, React 19.2.3, TypeScript (migrating from JavaScript). Verified against `package.json` July 2026.
- Entry: `App.js` (or `App.tsx`) wires `AuthContextProvider` and navigation.
- Routing: `@react-navigation/native-stack`, not Expo Router.
- Auth: JWT tokens in `expo-secure-store`; `store/auth-context.js` restores session through `utils/auth.js`.
- Backend base URL comes from `process.env.EXPO_PUBLIC_APP_BACKEND_URL`.
- Screens stay grouped by feature in `screens/`; reusable UI stays grouped by domain in `components/`.
- Shared style tokens live in `constants/theme.js`.
- UI strings go through `i18next` + `react-i18next` (+ `intl-pluralrules`), initialized in `i18n/index.ts` (fallback `en`, `returnEmptyString: false`). Locale JSON lives in `i18n/locales/<code>.json` with flat dot-namespaced `<domain>[.<subdomain>].<element>` keys (two or three segments, e.g. `settings.title`, `guess.path.returnHome`); `en` is the complete source of truth, other locales may be partial and fall back.
- UI locale (`uiLocale`, presentation only) is decoupled from `preferredLanguage` (hide/upload language) and `sessionLanguageFilter` (guess filter; `'any'` sentinel semantics untouched). Resolution is device-Intl → stored `uiLocale` → `en` (`utils/languageDefaults.js`); `store/i18n-context.js` (`I18nProvider`/`useUiLocale`) owns switching and persistence via `utils/storageDatum.js`.
- E2E mode (`isE2EMode()`) pins UI locale to `'en'` so Maestro copy stays English; `jest.setup.js` initializes i18n at `'en'` for every suite.
- New user-facing strings must use `t()` with the key complete in `en.json` and drafted in the other 8 locales.
- `constants/languages.js` is the single source of truth for BOTH guess/upload languages AND UI locales (9 entries incl. `id`, with `nativeName`); adding a language is one entry there, plus an `i18n/locales/<code>.json` bundle imported and registered in `i18n/index.ts` — no other file hardcodes the list.
- Native folders `android/` and `ios/` are part of this repo, but avoid touching generated build output under them unless task requires it.
- `postinstall` runs `patch-package`; current checked-in patch covers `react-native-google-mobile-ads`.
- Public guess category catalog is bundled in `constants/defaultCategories.js` (`getDefaultCategories()`, keyed by `key`, no server UUID); `utils/categoryRequests.js` `getCategories()` never hits the network (E2E mode returns its own stub). Thumbnails resolve from `utils/categoryAssets.js`.
- Private group categories are offline-cached stale-while-revalidate: `services/groups/groupCategoryCache.js` (AsyncStorage `groupCategories:<groupId>`) + `services/groups/groupCategoriesStore.js` (`loadGroupCategoriesOptimistic` renders cache then revalidates, replacing only on `categoryListSignature` diff; `refreshGroupCategories` writes through after owner CRUD). They keep using their UUID `category_id`; `key` is faked as `id` for display.
- Server image calls split by scope: public feed/upload/prefetch filter/assign by `category_key` (bundled string), private by `category_id` (UUID).
- Feed batch requests follow the played-exclusion contract (`exclude` CSV ≤200, `played-out` vs `empty` terminal split, byte-cache guard): see workspace [ADR 0015](../docs/adr/0015-public-feed-played-exclusion.md).

## Work Guidance

- Prefer TypeScript for new code. Migrating existing JavaScript to TypeScript is encouraged.
- Keep screen files thin when possible. Put reusable view logic in `components/` and request/helper logic in `utils/`.
- Prefer Jest for unit and mocked integration coverage. Use Maestro for full-device journeys, gesture-heavy flows, or deterministic E2E behavior.
- Keep source-of-truth runtime rules here; keep one-off proposals in `planning/` instead.
- Ignore `.expo/`, `node_modules/`, and packaged APK artifacts unless task explicitly targets them.
- If something is implemented for public or private groups, check that it works in both contexts, unless explicitly stated otherwise. Private groups have their own backend isolation rules and may require extra setup to test.

## Verification

- Run all app tests: `npm test`
- Run one Jest file: `npx jest __tests__/auth.test.js`
- Manual runtime check: `npx expo start`
- Native Android run when needed: `npx expo run:android`

## Child DOX Index

- `.maestro/AGENTS.md`: deterministic E2E flow contracts and runtime setup.

This parent continues to govern `screens/`, `components/`, `store/`, `services/`, `utils/`, `constants/`, `models/`, `__tests__/`, `assets/`, `android/`, `ios/`, and `patches/`.