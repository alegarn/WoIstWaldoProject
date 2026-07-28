/**
 * ADR: Overlay z-index stacking order
 * ===================================
 *
 * Single source of truth for z-index (and matching Android `elevation`) of
 * global full-screen / modal overlay layers across the app. Replaces the
 * magic literals (9000–9999) that were duplicated across components.
 *
 * Stack intent (low → high), values preserved exactly from pre-refactor code:
 *
 *   EnigmaOverlay / GuessExitSwipeMenu root container .... 9000
 *   handle / edge tab .................................... 9001
 *   dismiss scrim ........................................ 9002
 *   sliding panel ........................................ 9003
 *   AdInterstitial wrapper ............................... 9998
 *   SuccessOverlay / GuessExhaustedPanel ................. 9999
 *
 * Why AdInterstitial (9998) sits BELOW SuccessOverlay / GuessExhaustedPanel
 * (9999):
 *   - AdInterstitial (9998) mounts only AFTER SuccessOverlay (9999) has
 *     dismissed (see `useResolveLifecycle` ad-branch `overlayVisibleRef`
 *     gate); the z-order is defense-in-depth only, not the primary
 *     race-prevention mechanism.
 *   - GuessExhaustedPanel is the terminal "no more cards" gate; it must sit
 *     above every gameplay layer (including any lingering ad) so the user
 *     always sees the exit CTA.
 *
 * EnigmaOverlay / GuessExitSwipeMenu 9000→9003 progression:
 *   root scrim container (9000) < handle/edge tab (9001) < dismiss scrim
 *   (9002) < sliding panel (9003). Higher sibling wins pointer precedence
 *   when the panel is open.
 *
 * zIndex ↔ elevation pairing (Android):
 *   React Native's `zIndex` has no effect on Android; `elevation` does.
 *   Where both appear, keep them numerically equal so iOS and Android agree
 *   on ordering. Each member below is reused for both style props.
 *
 * LOCAL-STACK NOTE — intentionally excluded:
 *   Intra-component sibling stacking (GuessPathScreen z=10, SwipeableCard
 *   z=2, Instructions z=1) has no cross-file meaning; pulling it in would
 *   bloat this enum and dilute its purpose (global overlay ordering only).
 *   Those literals stay local to their components.
 */
export const OverlayZIndex = {
  ENIGMA_ROOT: 9000,
  ENIGMA_HANDLE: 9001,
  ENIGMA_SCRIM: 9002,
  ENIGMA_PANEL: 9003,
  EXIT_MENU_ROOT: 9000,
  EXIT_MENU_EDGE: 9001,
  EXIT_MENU_SCRIM: 9002,
  EXIT_MENU_PANEL: 9003,
  AD_INTERSTITIAL: 9998,
  SUCCESS_OVERLAY: 9999,
  EXHAUSTED_PANEL: 9999,
} as const;

export type OverlayZIndexKey = keyof typeof OverlayZIndex;
