// Android-only AdMob interstitial source. Wraps react-native-google-mobile-ads.
// On iOS: isReady() always returns false (Q1 — iOS ships no interstitial this phase).
//
// GDPR/ATT consent is a RELEASE OBLIGATION, not coded here.
// Deploy checklist:
//   - Configure GDPR/IDFA messaging in AdMob console (Privacy & messaging).
//   - Add extraProguardRules to app.json per expo guide.
//   - Set real ad unit id (currently placeholder below) via deploy secret / env.

import { Platform } from 'react-native';
import type { AdSource, HookSnapshot, HookSnapshotHandle } from './AdSource';

export const PLACEHOLDER_AD_UNIT_ID = 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy';
export const ADMOB_SHOW_TIMEOUT_MS = 30_000;
export const ADMOB_OPEN_TIMEOUT_MS = 10_000;
export const ADMOB_POLL_INTERVAL_MS = 200;

// The hook is React-coupled, so it must be mounted inside a component. The bridge component
// (see AdMobInterstitialBridge.js in this same file group) captures useInterstitialAd's
// return into a module-level snapshot object. For testability, the source accepts an
// injected hookSnapshot; production wiring passes the live bridge snapshot
// (set up in 03-mobile-wiring.md by mounting <AdMobInterstitialBridge /> inside AdScreen).

// Poll the live bridge snapshot for a state flip. Resolves true when predicate passes,
// false when the timeout elapses first. Tick-count based (no wall clock) so Jest fake
// timers stay deterministic. Registrable in a cancel registry so dispose() can stop
// the interval and release the pending show() wait (host unmount mid-show).
type PollCancel = () => void;

function waitForSnapshotState(
  predicate: () => boolean,
  timeoutMs: number,
  cancelRegistry: Set<PollCancel>,
): Promise<boolean> {
  return new Promise((resolve) => {
    let elapsed = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const finish = (result: boolean) => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      cancelRegistry.delete(cancel);
      resolve(result);
    };

    const cancel: PollCancel = () => finish(false);

    pollTimer = setInterval(() => {
      if (predicate() || elapsed >= timeoutMs) {
        finish(predicate());
        return;
      }
      elapsed += ADMOB_POLL_INTERVAL_MS;
    }, ADMOB_POLL_INTERVAL_MS);

    cancelRegistry.add(cancel);
  });
}

export function createAdMobInterstitialSource({
  hookSnapshot,
}: { hookSnapshot?: HookSnapshotHandle } = {}): AdSource {
  const pendingPolls = new Set<PollCancel>();
  let disposed = false;

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
      if (disposed) return;
      if (Platform.OS !== 'android') return;
      const snap = readHook();
      if (!snap || !snap.isLoaded) return;
      if (typeof snap.show !== 'function') return;
      try {
        // The hook's show() resolves immediately (fire-and-forget upstream), so the
        // real presentation signals are the snapshot flags: isOpened/isShowing flip
        // when the ad is on screen, isClosed when the user dismisses it. Wait for
        // open, then for close — otherwise the post-show route runs while the ad
        // is still opening. Contract: show never rejects; never-opened resolves as
        // no-op so the game continues.
        Promise.resolve(snap.show()).catch(() => {
          // Swallow late rejections; contract: show never rejects.
        });
        const opened = await waitForSnapshotState(() => {
          const current = readHook();
          return Boolean(current && (current.isShowing || current.isOpened));
        }, ADMOB_OPEN_TIMEOUT_MS, pendingPolls);
        if (!opened) return;
        await waitForSnapshotState(() => {
          const current = readHook();
          return Boolean(current && current.isClosed);
        }, ADMOB_SHOW_TIMEOUT_MS, pendingPolls);
      } catch {
        // Surface failures resolve as no-op (contract: show never rejects).
      }
    },

    dispose() {
      disposed = true;
      // Stop every running poll and resolve its show() wait (unmount mid-show).
      for (const cancel of [...pendingPolls]) {
        cancel();
      }
      pendingPolls.clear();
    },
  };
}
