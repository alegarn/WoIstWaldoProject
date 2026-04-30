# Maestro E2E Scaffold

This directory contains the initial Maestro mobile-flow scaffold for the two highest-value journeys identified in the testing assessment:

- `auth-boot-login.yml`
- `hide-to-guess-to-result.yml`

The flows are intentionally conservative. They only automate steps that currently have stable visible text in the React Native UI and stop where the app depends on missing selectors, OS-owned pickers, gesture coordinates, or nondeterministic remote data.

## Files

- `auth-boot-login.yml`: boot to login screen, assert the auth UI, and document the missing input selectors needed to finish the login journey.
- `hide-to-guess-to-result.yml`: start from an authenticated home state, cover entry into the hide and guess paths, and document the exact blockers that prevent a reliable hide-to-result run today.
- `e2e.env.example.yaml`: sample values for a non-production test account and reusable copy.

## Current Blockers

1. Login inputs are not automatable reliably.
   `components/Auth/Input.js` renders `TextInput` controls without `testID`, `accessibilityLabel`, or placeholder text, so Maestro has no stable way to focus the email and password fields.

2. The hide journey enters OS-owned media flows.
   `components/Picture/LogicalImagePicker.js` launches the camera or image library directly. That makes the flow depend on device permissions, picker UI outside the app, and a known test image being present on the emulator or device.

3. Hide and guess confirmation depends on coordinate-only image taps.
   `components/Picture/ShowPicture.js` uses an image `Pressable` plus a modal opened by tapping a dynamically positioned icon. There is no stable selector for the image surface, the target marker, or the confirmation anchor.

4. Guessing depends on remote or cached cards with no stable identifiers.
   `components/UI/SwipeImage.js` loads data from local storage and API requests, then renders gesture cards without fixed text or `testID` hooks that Maestro can target deterministically.

5. Result state is delayed behind a timed ad screen.
   `screens/GuessScreens/AdScreen.js` waits five seconds before routing to the result screen in the current non-ad path. That is testable, but it is slow and still depends on reaching the guess confirmation step first.

## What Is Needed To Execute Reliably Later

1. Add stable selectors to auth inputs, image pickers, swipe cards, image surfaces, confirmation buttons, and result actions.
2. Provide a non-production test account with predictable login credentials.
3. Seed at least one deterministic guessable image for the test account or add an internal dev shortcut that bypasses remote image loading.
4. Make the media source deterministic for the hide path, either by exposing an in-app fixture picker or preloading emulator media and stabilizing the OS permission flow.
5. Add a test-only path that skips or shortens the ad wait.

## Suggested Later Commands

Once the blockers above are addressed and Maestro is installed locally, the likely commands are:

```bash
maestro test .maestro/auth-boot-login.yml -e LOGIN_EMAIL=your.test.user@example.com -e LOGIN_PASSWORD=replace-me
maestro test .maestro/hide-to-guess-to-result.yml
```

The Android app id in this repo is `com.alegarn.WoIstWaldoProject`. The iOS bundle id in `app.json` is the same string.