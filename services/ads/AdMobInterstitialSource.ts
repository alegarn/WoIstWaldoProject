// Android-only AdMob interstitial source. Wraps react-native-google-mobile-ads.
// On iOS: isReady() always returns false (Q1 — iOS ships no interstitial this phase).
//
// GDPR/ATT consent (see AdScreen.js lines 12-34) is a RELEASE OBLIGATION, not coded here.
// Deploy checklist:
//   - Configure GDPR/IDFA messaging in AdMob console (Privacy & messaging).
//   - Add extraProguardRules to app.json per expo guide.
//   - Set real ad unit id (currently placeholder below) via deploy secret / env.

import { Platform } from 'react-native';
import type { AdSource, HookSnapshot, HookSnapshotHandle } from './AdSource';

export const PLACEHOLDER_AD_UNIT_ID = 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy';
export const ADMOB_SHOW_TIMEOUT_MS = 30_000;

// The hook is React-coupled, so it must be mounted inside a component. The bridge component
// (see AdMobInterstitialBridge.js in this same file group) captures useInterstitialAd's
// return into a module-level snapshot object. For testability, the source accepts an
// injected hookSnapshot; production wiring passes the live bridge snapshot
// (set up in 03-mobile-wiring.md by mounting <AdMobInterstitialBridge /> inside AdScreen).

export function createAdMobInterstitialSource({
  hookSnapshot,
}: { hookSnapshot?: HookSnapshotHandle } = {}): AdSource {
  function readHook(): HookSnapshot | null {
    if (hookSnapshot && typeof hookSnapshot.get === 'function') {
      return hookSnapshot.get();
    }
    return null;
  }

  return {
    isReady() {
      if (Platform.OS !== 'android') return false;
      const snap = readHook();
      return Boolean(snap && snap.isLoaded);
    },

    renderSurface() {
      return null;
    },

    async show() {
      if (Platform.OS !== 'android') return;
      const snap = readHook();
      if (!snap || !snap.isLoaded) return;
      if (typeof snap.show !== 'function') return;
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const showPromise = Promise.resolve(snap.show()).catch(() => {
          // Swallow late rejections; contract: show never rejects.
        });
        await Promise.race([
          showPromise,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, ADMOB_SHOW_TIMEOUT_MS);
          }),
        ]);
      } catch {
        // Surface failures resolve as no-op (contract: show never rejects).
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
