# WoIstWaldoProject — React Native App

## Purpose

- Govern work inside the Expo/React Native mobile app.
- Keep app-level architecture, verification, and folder ownership clear without adding child docs for every source folder.

## Ownership

- Owns mobile source, app config, native project files, Jest tests, fixtures, and patch-package patches inside this repo.
- `.maestro/` has its own child AGENTS file because E2E flows have separate runtime rules.

## Local Contracts

- Stack: Expo SDK 54, React Native 0.81, React 19, TypeScript (migrating from JavaScript).
- Entry: `App.js` (or `App.tsx`) wires `AuthContextProvider` and navigation.
- Routing: `@react-navigation/native-stack`, not Expo Router.
- Auth: JWT tokens in `expo-secure-store`; `store/auth-context.js` restores session through `utils/auth.js`.
- Backend base URL comes from `process.env.EXPO_PUBLIC_APP_BACKEND_URL`.
- Screens stay grouped by feature in `screens/`; reusable UI stays grouped by domain in `components/`.
- Shared style tokens live in `constants/theme.js`.
- Native folders `android/` and `ios/` are part of this repo, but avoid touching generated build output under them unless task requires it.
- `postinstall` runs `patch-package`; current checked-in patch covers `react-native-google-mobile-ads`.

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