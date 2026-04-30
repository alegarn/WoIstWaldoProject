# Maestro E2E Scaffold

This directory contains the initial Maestro mobile-flow scaffold for the two highest-value journeys identified in the testing assessment:

- `auth-boot-login.yml`
- `hide-to-guess-to-result.yml`

The flows are intentionally conservative. They only automate steps that currently have stable visible text in the React Native UI and stop where the app depends on missing selectors, OS-owned pickers, gesture coordinates, or nondeterministic remote data.

## Files

- `auth-boot-login.yml`: boot to login screen on a clean state, assert the auth UI through stable selectors, switch auth modes, and perform a real login when test credentials are supplied.
- `hide-to-guess-to-result.yml`: start from an authenticated home state and cover the selector-stable parts of the hide and guess paths, while documenting the remaining deterministic-fixture and coordinate blockers.
- `e2e.env.example.yaml`: sample values for a non-production test account and reusable copy.

## Current Blockers

1. Login inputs are not automatable reliably.
   Resolved. Auth inputs and submit/switch buttons now expose stable selectors such as `auth.input.email`, `auth.input.password`, and `auth.button.login-submit`.

2. The hide journey enters OS-owned media flows.
   `components/Picture/LogicalImagePicker.js` launches the camera or image library directly. That makes the flow depend on device permissions, picker UI outside the app, and a known test image being present on the emulator or device.

3. Hide and guess confirmation depends on coordinate-only image taps.
   Partially resolved. `components/Picture/ShowPicture.js` now exposes selectors like `game.picture.hide-surface`, `game.picture.guess-surface`, and modal anchors such as `game.picture.hide-modal.confirm`, but the actual target choice still depends on deterministic coordinates.

4. Guessing depends on remote or cached cards with no stable identifiers.
   Partially resolved. `components/UI/SwipeImage.js` and `components/UI/SwipeableCard.js` now expose `guess-path.swipe-stack` and `guess-path.card.*`, but the loaded data still needs to be deterministic.

5. Result state is delayed behind a timed ad screen.
   `screens/GuessScreens/AdScreen.js` waits five seconds before routing to the result screen in the current non-ad path. That is testable, but it is slow and still depends on reaching the guess confirmation step first.

## What Is Needed To Execute Reliably Later

1. Provide a non-production test account with predictable login credentials.
2. Seed at least one deterministic guessable image for the test account or add an internal dev shortcut that bypasses remote image loading.
3. Make the media source deterministic for the hide path, either by exposing an in-app fixture picker or preloading emulator media and stabilizing the OS permission flow.
4. Add a test-only path that skips or shortens the ad wait.
5. Optionally add explicit result/action selectors if you want Maestro to assert deeper past the current ad handoff.

## Suggested Later Commands

Once the blockers above are addressed and Maestro is installed locally, the likely commands are:

```bash
maestro test .maestro/auth-boot-login.yml -e LOGIN_EMAIL=your.test.user@example.com -e LOGIN_PASSWORD=replace-me
maestro test .maestro/hide-to-guess-to-result.yml
```

The Android app id in this repo is `com.alegarn.WoIstWaldoProject`. The iOS bundle id in `app.json` is the same string.