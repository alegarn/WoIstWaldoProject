# E2E Mode Documentation (Mobile)

## Overview
`E2E Mode` is a diagnostic and testing state in the WoIstWaldo mobile app. It is designed to bypass non-deterministic elements (like native camera UI, random backend data, and ad delays) to allow for reliable automated End-to-End (E2E) testing, specifically for tools like **Maestro**.

## Activation
E2E Mode is activated via the environment variable `EXPO_PUBLIC_E2E_MODE`.
- **Enabled**: `true`
- **Disabled**: (Default/any other value)

In a terminal or `.env` file:
```bash
EXPO_PUBLIC_E2E_MODE=true
```

## Core Functions ([utils/e2eMode.js](WoIstWaldoProject/utils/e2eMode.js))

The `e2eMode.js` utility provides several shims used throughout the app:

### 1. UI Bypassing (`isE2EMode`)
Used to skip native module interactions that automated scripts cannot easily control.
- **Image Picking**: Instead of opening the system photo library, the app immediately navigates to the "Hide" screen with a pre-loaded local asset ([farm_pict_320.jpg](WoIstWaldoProject/assets/tutorial/farm_pict_320.jpg)).
- **Ad Delays**: Sets ad-related timers to 0ms for faster test execution.

### 2. Deterministic Coordinates
To test the "Guess" and "Hide" logic without human interaction, E2E mode uses hardcoded targets:
- **Location**: `{ x: 0.58, y: 0.46 }`
- **Purpose**: A Maestro script can be programmed to tap exactly at these relative coordinates to simulate a "Success" find every time.

### 3. Backend Mocking
When the backend is unavailable or needs to be static for a test:
- **Mock Categories**: `buildE2ECategories()` returns a fixed list (Nature, City, People, etc.).
- **Mock Rankings**: `buildE2ERankingResponse()` provides fake leaderboard data.
- **Mock User Scores**: `buildE2EUserScores()` returns predictable stats.

## Practical Usage in Tests
When writing a Maestro flow:
1. Ensure the app is built with `EXPO_PUBLIC_E2E_MODE=true`.
2. Use the `E2E_HIDE_LOCATION` coordinates in your tap commands.
3. Expect the static "Nature" category and "e2e_user" in the ranking tables.

## Why is it practical?
- **No Flakiness**: Tests don't fail because a real user deleted an image on the server.
- **Speed**: No waiting for real ad timers or network latency.
- **Automation**: Allows a "lights-out" testing environment where no human is needed to select a photo or grant camera permissions manually.

## Can E2E tests be done without it?
While technically possible, it is extremely difficult. Without E2E mode, you would need to:
1. Orchestrate a real backend with specific data.
2. Automate the native OS "Allow Camera" and "Photo Gallery" popups (which varies between Android and iOS).
3. Update your test scripts every time the "Recent" images on the server change.
