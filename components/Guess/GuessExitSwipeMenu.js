import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

const EDGE_WIDTH = 36;
const SWIPE_THRESHOLD_PX = 40;
const TAP_THRESHOLD = 8;
const PANEL_WIDTH = 160;

export default function GuessExitSwipeMenu({ onHome }) {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  const openPanel = useCallback(() => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, panelOpacity]);

  const closePanel = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -PANEL_WIDTH,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
    });
  }, [translateX, panelOpacity]);

  const edgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_e, gs) => gs.x0 <= EDGE_WIDTH,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderRelease: (_e, gs) => {
          if (gs.dx >= SWIPE_THRESHOLD_PX && Math.abs(gs.dx) > Math.abs(gs.dy)) {
            openPanel();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [openPanel]
  );

  const scrimPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderRelease: (_e, gs) => {
          const isSwipeLeft =
            gs.dx <= -SWIPE_THRESHOLD_PX && Math.abs(gs.dx) > Math.abs(gs.dy);
          const isTap =
            Math.abs(gs.dx) < TAP_THRESHOLD && Math.abs(gs.dy) < TAP_THRESHOLD;
          if (isSwipeLeft || isTap) {
            closePanel();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [closePanel]
  );

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 9000, elevation: 9000 }]}>
      <View
        testID="guess.exit.edge"
        {...edgePanResponder.panHandlers}
        style={styles.edge}
      />

      {isOpen ? (
        <>
          <Pressable
            accessibilityLabel="Close exit panel"
            accessibilityRole="button"
            onPress={closePanel}
            {...scrimPanResponder.panHandlers}
            style={styles.scrim}
            testID="guess.exit.scrim"
          />
          <Animated.View
            style={[styles.panel, { transform: [{ translateX }] }, { opacity: panelOpacity }]}
            testID="guess.exit.panel"
          >
            <View style={styles.panelHeader}>
              <Pressable
                accessibilityLabel="Close exit panel"
                accessibilityRole="button"
                onPress={closePanel}
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
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_WIDTH,
    backgroundColor: 'transparent',
    zIndex: 9001,
    elevation: 9001,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    zIndex: 9002,
    elevation: 9002,
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
    zIndex: 9003,
    elevation: 9003,
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
