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
