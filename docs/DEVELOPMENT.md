# Development Guide - WoIstWaldo Mobile

## Prerequisites
- **Node.js**: Recommended version 20.x or higher.
- **Expo Go**: Download the Expo Go app on your mobile device to test.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Variables:
   Create a `.env` file in `WoIstWaldoProject/` with the following variables:
   - `EXPO_PUBLIC_APP_BACKEND_URL`: The URL of your running Rails API (e.g., `http://localhost:3000/`). **Ensure it ends with a trailing slash.**
   - `EXPO_PUBLIC_E2E_MODE`: Set to `true` to enable mock data/E2E mode, or `false` to use the real backend.

3. Run the application:
   ```bash
   npx expo start
   ```

## Development Client
This project uses `expo-dev-client`. To run on a physical device or emulator with native modules:
```bash
npm run android # For Android
npm run ios     # For iOS
```

## Testing
We use [Jest](https://jestjs.io/) for unit and component testing.
- Run all tests:
  ```bash
  npm test
  ```
- Run a specific test:
  ```bash
  npx jest __tests__/some.test.js
  ```

## Guess feed cards
The guess feed renders one card per image. Two interaction contracts are owned by dedicated components.

- **Enigma preview**: Each card shows the enigma text directly, clamped to at most 2 lines. A chevron button and a vertical swipe expand the full enigma. Implemented in `components/Picture/Descriptions/GuessDescription.js`.
- **Star/? badge detail modal**: The badge in the top-left of a card shows a star (rated) or a "?" (unrated). Tapping it opens a detail modal, hoisted once in `SwipeImage` (`components/UI/SwipeImage.js`) and rendered by `components/UI/BadgeDetailModal.js`. When available, the modal shows the enigma (full description), language, category, tags, creator, created date, the global rating (average), and the detailed ratings (Image Quality, Enigma Quality, Fun, Difficulty). Tags are fetched on open via `getImageTags` and the detailed ratings via `getImageRating`, both from `utils/ratingRequests.js`. Fetching is owned by the `useBadgeDetail` hook (`components/UI/useBadgeDetail.js`).
- **Fullscreen layout**: The app runs fullscreen so the bottom of the screen (and with it the card enigma band) is not clipped by system bars. The status bar is hidden via `app.json` (`expo-status-bar` plugin configuration `statusBarHidden`). On Android the navigation bar is hidden at runtime in `App.js` via the declarative `expo-navigation-bar` component `<NavigationBar hidden />` rendered at the app root (the idiomatic API for `expo-navigation-bar@56`; `setPositionAsync`/`setBehaviorAsync` were removed in this version). iOS is fullscreen via `app.json` (`ios.requireFullScreen`).
- **Swipe-feedback overlay does not block the badge**: The swipe-feedback overlay (`Animated.Image` in `components/UI/SwipeableCard.js`) is rendered with `pointerEvents="none"`, so it never intercepts taps on the star/? badge even though it overlays the card.

## Guess play screen
The play screen (where the user taps/drags to find the hidden spot) renders through `screens/GuessScreens/GuessScreen.js` → `components/Picture/GuessPicture.js` → `components/Picture/ShowPicture.js`. The enigma hint is owned by a bottom-sheet overlay component, replacing the former draggable `MovableTextBox`.

- **Enigma overlay**: The hint text is rendered by `EnigmaOverlay` (`components/Picture/Descriptions/EnigmaOverlay.js`), replacing the old click-to-toggle draggable `MovableTextBox`.
- **Closed state**: A grabber handle is pinned to the bottom edge; the overlay starts closed on the first card.
- **Open**: An UP swipe (bottom→top) on the handle expands the panel.
- **Close**: Via the down-arrow icon button (`IconButton` with `chevron-down`), a DOWN swipe on the panel, or a tap on the scrim.
- **Auto-open on second card onward**: After a correct guess, `skipInstructions: true` is set in `utils/handleGuessOutcome.js` / `utils/guessNavigation.js`. `GuessPicture` passes it through as `defaultOpen={skipInstructions === true}` to `ShowPicture` → `EnigmaOverlay`, so the enigma auto-opens on the next card for direct reading.
- **Gesture isolation**: The overlay's swipe responders are scoped to its own handle/panel/scrim; they do not steal the draggable target marker (its own `PanResponder` on the target wrap) or the left-edge `GuessExitSwipeMenu` swipe.
- **Test/e2e hooks**: `testIDs` — `guess.enigma.handle`, `guess.enigma.panel`, `guess.enigma.text`, `guess.enigma.close`, `guess.enigma.scrim`. Close button accessibility label: "Close enigma".
