// Composite AdSource. Single testable fallback decision (SRP).
// AdScreen receives ONE source (this composite); no if/else in AdScreen (G23).
// Trivially correct: show() delegates to the picked source and resolves when it does.

import type { ReactNode } from 'react';
import type { AdSource } from './AdSource';

export function createFallbackAdSource(primary: AdSource, secondary: AdSource): AdSource {
  if (!primary || typeof primary.isReady !== 'function') {
    throw new Error('FallbackAdSource: primary must implement AdSource');
  }
  if (!secondary || typeof secondary.isReady !== 'function') {
    throw new Error('FallbackAdSource: secondary must implement AdSource');
  }

  function pick() {
    return primary.isReady() ? primary : secondary;
  }

  // Sticky pick for the current show cycle. renderSurface() precedes show()
  // (render precedes effect), so the FIRST caller decides; both then agree on
  // one source until the cycle ends (active cleared in show()'s finally).
  let active: AdSource | null = null;

  return {
    isReady() {
      return primary.isReady() || secondary.isReady();
    },

    renderSurface(): ReactNode {
      active ??= pick();
      return active.renderSurface();
    },

    async show() {
      // Decision lives here and nowhere else. Wrap to enforce the AdSource contract:
      // show() never rejects (callers rely on this for post-show routing).
      try {
        active ??= pick();
        await active.show();
      } catch {
        // Surface failures resolve as no-op (contract).
      } finally {
        active = null;
      }
    },

    dispose() {
      // A stale sticky pick must not survive unmount-before-show: the next cycle
      // has to re-decide (the previously picked source may have disposed/unloaded).
      active = null;
      primary.dispose?.();
      secondary.dispose?.();
    },
  };
}
