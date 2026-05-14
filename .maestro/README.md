# Maestro E2E Flows

This directory contains login-first Maestro flows for the deterministic app runtime mode.

## Files

- `auth-boot-login.yml`: clean launch/login smoke flow using the stable auth and home-screen ids.
- `hide-login-save-picture.yml`: logs in, hides a point, uploads the fixture image, and saves the hidden-picture bridge payload for later guess flows.
- `guess-login-saved-picture-success.yml`: logs in, opens the guess path, reuses the saved hide payload, and verifies the success result.
- `guess-login-saved-picture-failure.yml`: logs in, opens the guess path, reuses the saved hide payload, long-presses the guess surface to select the E2E wrong point, and verifies the failure result.
- `hide-to-guess-to-result.yml`: full deterministic login -> hide -> guess -> ranking journey using the saved hide payload bridge.
- `auth-boot-signup.yml`: legacy signup smoke flow retained for manual use only; it is not part of the recommended coverage because it creates backend rows every run.
- `e2e.env.example.yaml`: sample Maestro flow variables only.

## Runtime Requirement

`EXPO_PUBLIC_E2E_MODE=true` must be present when the React Native bundle is started or when the app under test is built.

If the installed app opens on the Expo Development Build launcher instead of your login/home screen, the dev client has not connected to a Metro server yet. Start Metro first, then relaunch the app. For a direct `logo -> app` launch without Metro, use a non-dev build.

The checked-in auth flows intentionally avoid `clearState: true` because clearing app data also clears Expo Dev Client's remembered project on Android and can bounce the run back to the launcher instead of the app bundle.

On a fresh Expo Dev Client install, the first app open can also show the Dev Client onboarding sheet over your app. The checked-in auth flows dismiss that sheet automatically with an optional `Continue` step. If the Expo Dev Client menu itself is open, the flows also use an optional `Go home` step before touching app selectors.

If a restored session lands on `HomeScreen` with the tutorial prompt open, the auth flows also dismiss that modal with an optional `Close` step before tapping the logout header action.

Examples:

```bash
EXPO_PUBLIC_E2E_MODE=true npx expo start --dev-client
EXPO_PUBLIC_E2E_MODE=true npx expo run:android
```

If you are testing a prebuilt artifact, the same env must be present during the build that produced that artifact.

Maestro `-e` variables and values loaded from an env file do not toggle the app runtime mode. They only supply flow inputs such as login credentials, hide descriptions, expected result text, and seeded leaderboard expectations.

The checked-in sample file is `.maestro/e2e.env.example.yaml`. Copy it to `.maestro/e2e.env.yaml` or pass the example file directly after replacing the placeholder credentials. The flow files themselves do not define fallback env values, so the env file or `-e` CLI values are the source of truth at runtime.

## What Deterministic E2E Mode Changes

- `image-picker.button.select-image` bypasses the OS picker and navigates directly to `HideScreen` with a bundled fixture image.
- In E2E mode, `game.instructions.hide.overlay` and `game.instructions.guess.overlay` dismiss the full-screen instruction overlays directly, which is more reliable on device than targeting the inner CTA button.
- `SetInstructionsScreen` saves a hidden-picture payload into app storage after a successful hide upload.
- `SwipeImage` prefers that saved payload in E2E mode before falling back to the seeded guess card.
- `guess-path.card.saved` proves the saved hide payload is present; `guess-path.card.fallback` identifies the seeded fallback card.
- On the guess screen, a normal tap on `game.picture.guess-surface` selects the saved hidden point. A long press on the same surface selects the deterministic incorrect point for failure coverage.
- `guess-path.card.1` is either the saved hidden picture or the seeded fallback card; swiping it to the right enters the guess screen.
- Ranking data is seeded deterministically; the first row name is `John`.
- Ad delay is reduced to zero, so the result screen is reached immediately after guess confirmation.

- `result.screen.success` and `result.screen.failure` expose stable outcome assertions without relying on localized result copy.

## Running The Flows

```bash
cp .maestro/e2e.env.example.yaml .maestro/e2e.env.yaml
maestro test .maestro/auth-boot-login.yml --env-file .maestro/e2e.env.yaml
maestro test .maestro/hide-login-save-picture.yml --env-file .maestro/e2e.env.yaml
maestro test .maestro/guess-login-saved-picture-success.yml --env-file .maestro/e2e.env.yaml
maestro test .maestro/guess-login-saved-picture-failure.yml --env-file .maestro/e2e.env.yaml
maestro test .maestro/hide-to-guess-to-result.yml --env-file .maestro/e2e.env.yaml
```

Run `hide-login-save-picture.yml` before either guess-only flow. Those guess-only flows now assert `guess-path.card.saved`, so they fail early if the saved payload bridge was never created.

The Android app id is `com.alegarn.WoIstWaldoProject`.

Deterministic mode stubs image upload, ranking, score updates, and guess-card data, but auth still uses the configured backend. The recommended coverage path is login-only with a reusable non-production account so Maestro does not bloat the backend with new signup records.