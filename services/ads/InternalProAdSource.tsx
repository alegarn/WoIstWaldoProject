// Internal Pro-mode ad source. Mock-first.
// Renders a simple branded panel: "Tired of ads? Go Pro" CTA + Continue button.
// isReady() always true (synchronous, no network). show() resolves on Continue tap
// (_continue()) OR after INTERNAL_AD_TIMEOUT_MS (named constant, G25).
//
// This source OWNS its panel JSX via renderSurface(). AdScreen renders whatever the
// active source returns — never reaches through the contract for impl-specific hooks.
// See 03-mobile-wiring.md for the render contract.
//
// show() resolving IS the sole completion signal — exactly one completion path (SRP).

import { Button, Text, View } from 'react-native';

import { adPanel } from '../../constants/theme';
import type { ReactNode } from 'react';
import type { AdSource } from './AdSource';

export const INTERNAL_AD_TIMEOUT_MS = 3000;
export const INTERNAL_AD_PANEL_TESTID = 'ad.internal.pro.panel';
export const INTERNAL_AD_CONTINUE_TESTID = 'ad.internal.pro.continue';

export interface InternalProAdSource extends AdSource {
  _continue(): void;
}

export function createInternalProAdSource(): InternalProAdSource {
  let resolveCurrent: (() => void) | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function resolveAndCleanup() {
    if (resolveCurrent) {
      const r = resolveCurrent;
      resolveCurrent = null;
      clearTimer();
      r();
    }
  }

  return {
    isReady() {
      return true;
    },

    renderSurface(): ReactNode {
      return (
        <View
          testID={INTERNAL_AD_PANEL_TESTID}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: adPanel.padding }}
        >
          <Text style={{ fontSize: adPanel.titleFontSize, fontWeight: adPanel.titleFontWeight, marginBottom: adPanel.titleMarginBottom }}>
            Tired of ads?
          </Text>
          <Text style={{ fontSize: adPanel.bodyFontSize, color: adPanel.bodyColor, marginBottom: adPanel.bodyMarginBottom, textAlign: 'center' }}>
            Go Pro to hide every ad.
          </Text>
          <Button
            testID={INTERNAL_AD_CONTINUE_TESTID}
            title="Continue"
            onPress={resolveAndCleanup}
          />
        </View>
      );
    },

    async show() {
      // Single-flight guard: if a previous show() is still pending, resolve it before
      // starting a new cycle (no leaked promises).
      if (resolveCurrent) {
        resolveAndCleanup();
      }
      clearTimer();

      closeTimer = setTimeout(resolveAndCleanup, INTERNAL_AD_TIMEOUT_MS);

      await new Promise<void>((resolve) => {
        resolveCurrent = resolve;
      });
    },

    // Tap / test hook: resolves show() immediately. NOT part of the AdSource interface;
    // named with leading underscore (N10 accepted convention). Tests dismiss show() directly.
    _continue: resolveAndCleanup,
  };
}
