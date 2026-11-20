// Ambient declarations for the sibling react-native-google-mobile-ads.js jest mock.
// jest-haste loads the .js at runtime; this .d.ts is type-only and ignored by jest.
// Hook return shape mirrors the official useInterstitialAd return values.

export interface InterstitialAdHookReturn {
  isLoaded: boolean;
  isOpened: boolean;
  isClosed: boolean;
  isShowing: boolean;
  load: () => void;
  show: () => void;
}

export const TestIds: { INTERSTITIAL: string };

export const useInterstitialAd: (...args: unknown[]) => InterstitialAdHookReturn;

export const MobileAds: () => {
  initialize: () => Promise<void>;
  setRequestConfiguration: (...args: unknown[]) => Promise<void>;
};
