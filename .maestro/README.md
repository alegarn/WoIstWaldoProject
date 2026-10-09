# Maestro E2E Flows

This directory contains login-first Maestro flows for the deterministic app runtime mode.

## Files

- `auth-boot-login.yml`: clean launch/login smoke flow using the stable auth and home-screen ids.
- `hide-login-save-picture.yml`: assumes an already-connected, logged-in session on HomeScreen; hides a point, uploads the fixture image, walks the 3-step describe → language → category wizard, and saves the hidden-picture bridge payload for later guess flows.
- `hide-shape-to-guess.yml`: same session assumptions; picks shape mode (the E2E shape chip auto-seeds the deterministic outline), confirms the outline, walks the same 3-step wizard, and saves the shape-mode bridge payload for the shape guess flows.
- `guess-login-saved-picture-success.yml`: assumes an already-connected, logged-in session on HomeScreen; opens the guess path, reuses the saved hide payload, submits a star rating, verifies the success result actions, then uses `Next Card` to confirm direct continuation into the next guess.
- `guess-login-saved-picture-failure.yml`: assumes an already-connected, logged-in session on HomeScreen; opens the guess path, reuses the saved hide payload, long-presses the guess surface to select the E2E wrong point, verifies the failure result actions, then uses `Next Card` to confirm direct continuation into the next guess.
- `guess-shape-success.yml`: opens the guess path on the saved shape payload, taps the guess surface to seed the deterministic HIT outline, confirms it, and asserts the in-place success overlay.
- `guess-shape-failure.yml`: opens the guess path on the saved shape payload, long-presses the guess surface to seed the deterministic MISS outline, confirms it, and asserts the text-only failure ResultScreen actions.
- `hide-to-guess-to-result.yml`: assumes an already-connected, logged-in session on HomeScreen; runs the deterministic hide -> guess -> ranking journey using the saved hide payload bridge.
- `auth-boot-signup.yml`: signup smoke flow that generates unique credentials at runtime so it can be rerun without email or username collisions.
- `private-manage-mode-smoke.yml`: NON-destructive smoke of the owner-only private category manage UI. Switches to a private group, opens the GuessPathScreen "manage" modal, asserts the Update-images / Delete-categories options, and that the per-card pencil / trash icons appear only in the chosen mode. Never taps a pencil/trash. See "Private group flows" below for preconditions.
- `private-category-delete.yml`: DESTRUCTIVE smoke of the owner-only Delete-categories path. Manage → delete mode → tap the first card's trash → confirm the system Alert → assert the grid reloaded with the category removed. Issues a real backend DELETE (category CRUD is not stubbed). See "Private group flows" below for preconditions.
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

Maestro `-e KEY=VALUE` variables passed inline on the auth flow CLI supply flow inputs such as login credentials, hide descriptions, expected result text, and seeded leaderboard expectations. They do not toggle the app runtime mode.

The checked-in sample file is `.maestro/e2e.env.example.yaml`; it only documents the available flow inputs. The feature flows take no env vars, and the auth flow takes its login credentials via `-e LOGIN_EMAIL=... -e LOGIN_PASSWORD=...` on the command line. The flow files themselves do not define fallback env values, so the `-e` CLI values are the source of truth at runtime.

## What Deterministic E2E Mode Changes

- `image-picker.button.select-image` bypasses the OS picker and navigates directly to `HideScreen` with a bundled fixture image.
- In E2E mode, `game.instructions.hide.overlay` and `game.instructions.guess.overlay` dismiss the full-screen instruction overlays directly, which is more reliable on device than targeting the inner CTA button.
- `SetInstructionsScreen` saves a hidden-picture payload into app storage after a successful hide upload.
- `SetInstructionsScreen` now gates the hide save behind a 3-step wizard (describe → language → category); the flow taps `set-instructions.button.next` twice before `set-instructions.button.confirm-description`.
- `SwipeImage` prefers that saved payload in E2E mode before falling back to the seeded guess card.
- Guess flows now enter the swipe stack through the synthetic `guess-path.category.card.all` category before dismissing `guess-path.button.start`.
- `guess-path.card.saved` proves the saved hide payload is present; `guess-path.card.fallback` identifies the seeded fallback card.
- On the guess screen, a normal tap on `game.picture.guess-surface` selects the saved hidden point. A long press on the same surface selects the deterministic incorrect point for failure coverage.
- `guess-path.card.1` is either the saved hidden picture or the seeded fallback card; swiping it to the right enters the guess screen.
- Hide mode picker: `game.picture.mode-picker` with `game.picture.mode-chip-point` / `game.picture.mode-chip-shape` chips. Selecting the shape chip in E2E mode auto-seeds the hidden outline from the deterministic shim polygon — no traced gestures. The ShapeCanvas renders `game.picture.shape-surface`, and the stored outline as `game.picture.shape-outline`.
- Shape confirm/redraw reuses the picture modal with the pinned labels `Confirm outline` / `Redraw outline`. On the hide side the modal auto-opens whenever a drawable outline exists — both from a real stroke on `game.picture.shape-surface` and from the E2E shape chip seed (see `hide-shape-to-guess.yml`).
- On a shape guess card the surface swipe classifier is suppressed, so `Re-open enigma` (`game.picture.shape-enigma`) and `Exit` (`game.picture.shape-exit`) render as explicit controls at the bottom of the screen.
- On a shape guess card, a normal tap on `game.picture.guess-surface` seeds the deterministic HIT outline and auto-opens the confirm modal; a long press seeds the deterministic MISS outline. Confirming runs the both-direction outline match against the saved shape (10s speed window).
- Ranking data is seeded deterministically; the first row name is `John`.
- Ad delay is reduced to zero, so the result screen is reached immediately after guess confirmation.
- On success, `result.button.home` and `result.button.next` appear only after selecting a global star on `result.rating.global.star.{1-5}` and waiting for the auto-submit to finish.
- `result.button.next` replaces the old `result.button.another` selector on both success and failure outcomes.
- `result.button.next` routes directly into the next guess when another card exists, so `_shared/return_home.yaml` now unwinds GuessScreen and GuessFeedScreen as part of cleanup.

- `result.screen.success` and `result.screen.failure` expose stable outcome assertions without relying on localized result copy.

## Running The Flows

The app is an Expo Dev Client: re-launching it breaks the Metro JS bundle connection (the dev client must be reconnected manually each time). To avoid that, run in two phases.

### Phase 1 — establish the session once

Launch the app, connect it to Metro, log in, and land on HomeScreen. Either do this manually, or run:

```bash
maestro test .maestro/auth-boot-login.yml -e LOGIN_EMAIL=a@a.com -e LOGIN_PASSWORD=aaaaaa
```

This is the ONLY flow that re-launches the app and logs in. After it completes, the app stays open, connected, and on HomeScreen.

### Phase 2 — run feature flows in sequence

The feature flows assume the app is already on HomeScreen. They do NOT re-launch or re-login. Each ends back on HomeScreen so the next one starts from the same point. Run them in order (hide must run before the guess-only flows, because they assert the saved payload the hide flow creates):

```bash
maestro test .maestro/hide-login-save-picture.yml
maestro test .maestro/guess-login-saved-picture-success.yml
maestro test .maestro/guess-login-saved-picture-failure.yml
maestro test .maestro/hide-to-guess-to-result.yml
```

These flows take no env vars.

### Shape mode flows

The shape flows cover the public-scope shape journey only (the private shape journey is manual). They follow the same order contract as the point flows — a shape hide must run before the shape-only guess flows, because they assert the shape bridge payload the hide flow creates:

```bash
maestro test .maestro/hide-shape-to-guess.yml
maestro test .maestro/guess-shape-success.yml
maestro test .maestro/guess-shape-failure.yml
```

These flows take no env vars either. Notes:

- Run them AFTER `hide-login-save-picture.yml` in a Phase 2 sequence; `hide-shape-to-guess.yml` overwrites the bridge payload with the shape-mode one, so re-run `hide-login-save-picture.yml` afterwards if you want the point-only guess flows to see the point payload again.
- No drawing gestures are used anywhere: the hidden outline is seeded by the shape chip, and the guess outline is seeded by tap (HIT) / long press (MISS) on the guess surface.
- The hide-side confirm modal auto-opens as soon as a drawable outline exists (chip-seeded in E2E mode), matching the guess-side behavior.

### Private group flows

The two `private-*.yml` flows exercise the owner-only category manage UI on a **private** group's GuessPathScreen. Unlike the public flows above, the private surface is NOT reachable from the default seeded state — these preconditions must hold on the device before running them (after the Phase 1 login):

- The logged-in account **owns** at least one private group.
- `private-category-delete.yml` requires that group to have **≥ 2 owner-created categories** (it deletes one and asserts a trash icon remains for the reload).
- The app is on HomeScreen at flow start.

Notes:
- These flows inline their own private→public cleanup (switch-to-public) because `_shared/return_home.yaml` is tuned for the public stack (it asserts `home.button.ranking` directly).
- `private-category-delete.yml` is **destructive**: category CRUD is not stubbed by e2e mode, so it issues a real backend `DELETE` and the test account loses one category per run. Reseed as needed.
- Per-card pencil/trash testIDs embed the category UUID, so the flows target the first match via regex (`guess-path.category.edit.*` / `guess-path.category.delete.*`); they do not assert a named category. Precise handler assertions live in `__tests__/GuessPathScreen.test.js`.
- The category-thumbnail picker has no e2e bypass, so the update-image path is covered only up to "pencil icon appears in update mode"; a full thumbnail-swap device test needs an e2e hook in `categoryThumbnailUpload.js`.

```bash
maestro test .maestro/private-manage-mode-smoke.yml
maestro test .maestro/private-category-delete.yml
```

The Android app id is `com.alegarn.WoIstWaldoProject`.

Deterministic mode stubs image upload, ranking, score updates, and guess-card data, but auth still uses the configured backend. The recommended coverage path is login-only with a reusable non-production account so Maestro does not bloat the backend with new signup records.