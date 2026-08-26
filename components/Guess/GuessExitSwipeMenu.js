import { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { OverlayZIndex } from '../../constants/overlayZIndex';
import SwipeHaloHint from './SwipeHaloHint';

const PANEL_WIDTH = 160;

// Controlled exit menu. The legacy PanResponder-based edge strip lived in this
// separate higher-zIndex subtree, where it intercepted touches in the left
// 36px and the target circle's responder chain was never consulted there. The
// edge strip is removed; the right-edge swipe now lives in the picture subtree
// (ShowPicture's nested RNGH surface detector) and drives `isOpen` from the
// parent. This component is purely presentational.
export default function GuessExitSwipeMenu({ isOpen, onClose, onHome, showHints = false, onInteract }) {
  useEffect(() => {
    if (isOpen) {
      onInteract?.();
    }
  }, [isOpen, onInteract]);

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: OverlayZIndex.EXIT_MENU_ROOT, elevation: OverlayZIndex.EXIT_MENU_ROOT }]}>
      {isOpen ? (
        <>
          <Pressable
            accessibilityLabel="Close exit panel"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.scrim}
            testID="guess.exit.scrim"
          />
          <Animated.View
            style={[styles.panel]}
            testID="guess.exit.panel"
          >
            <View style={styles.panelHeader}>
              <Pressable
                accessibilityLabel="Close exit panel"
                accessibilityRole="button"
                onPress={onClose}
                style={styles.closeButton}
                testID="guess.exit.close"
              >
                <Text style={styles.closeLabel}>✕</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityLabel="Go home"
              accessibilityRole="button"
              onPress={onHome}
              style={styles.homeButton}
              testID="guess.exit.home"
            >
              <Text style={styles.homeLabel}>Home</Text>
            </Pressable>
          </Animated.View>
        </>
      ) : null}
      <SwipeHaloHint visible={showHints && !isOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    zIndex: OverlayZIndex.EXIT_MENU_SCRIM,
    elevation: OverlayZIndex.EXIT_MENU_SCRIM,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: GlobalStyle.color.primaryColor900,
    paddingTop: 64,
    paddingHorizontal: 16,
    zIndex: OverlayZIndex.EXIT_MENU_PANEL,
    elevation: OverlayZIndex.EXIT_MENU_PANEL,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor700,
  },
  closeLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    borderRadius: 10,
    backgroundColor: GlobalStyle.color.primaryColor700,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  homeLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
