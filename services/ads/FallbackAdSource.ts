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

  return {
    isReady() {
      return primary.isReady() || secondary.isReady();
    },

    renderSurface(): ReactNode {
      return pick().renderSurface();
    },

    async show() {
      // Decision lives here and nowhere else. Wrap to enforce the AdSource contract:
      // show() never rejects (callers rely on this for post-show routing).
      try {
        await pick().show();
      } catch {
        // Surface failures resolve as no-op (contract).
      }
    },
  };
}
