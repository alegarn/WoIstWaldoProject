import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import IconButton from '../../UI/IconButton';
import { GlobalStyle } from '../../../constants/theme';

const SWIPE_THRESHOLD_PX = 40;
const TAP_THRESHOLD = 8;
const PANEL_HEIGHT_RATIO = 0.35;
const PANEL_MIN_HEIGHT = 120;
const HANDLE_HEIGHT = 28;
const CLOSE_ICON_SIZE = 24;

function buildPanelHeight(screenHeight) {
  const computed = Math.round(screenHeight * PANEL_HEIGHT_RATIO);
  return Math.max(computed, PANEL_MIN_HEIGHT);
}

export default function EnigmaOverlay({ description, screenHeight, defaultOpen, onClose }) {
  const panelHeight = buildPanelHeight(screenHeight);
  const [isOpen, setIsOpen] = useState(!!defaultOpen);
  const translateY = useRef(new Animated.Value(defaultOpen ? 0 : panelHeight)).current;
  const previousDefaultOpenRef = useRef(!!defaultOpen);

  useEffect(() => {
    const previousDefaultOpen = previousDefaultOpenRef.current;
    if (previousDefaultOpen === !!defaultOpen) {
      return;
    }

    previousDefaultOpenRef.current = !!defaultOpen;
    if (defaultOpen) {
      setIsOpen(true);
      translateY.setValue(0);
      return;
    }

    translateY.setValue(panelHeight);
    setIsOpen(false);
  }, [defaultOpen, panelHeight, translateY]);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const closePanel = useCallback(() => {
    onClose?.();
    Animated.timing(translateY, {
      toValue: panelHeight,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
    });
  }, [translateY, panelHeight, onClose]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderRelease: (_e, gs) => {
          const isUpSwipe = gs.dy <= -SWIPE_THRESHOLD_PX && Math.abs(gs.dy) > Math.abs(gs.dx);
          if (isUpSwipe) {
            openPanel();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [openPanel]
  );

  const dismissPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderRelease: (_e, gs) => {
          const isDownSwipe = gs.dy >= SWIPE_THRESHOLD_PX && Math.abs(gs.dy) > Math.abs(gs.dx);
          const isTap = Math.abs(gs.dx) < TAP_THRESHOLD && Math.abs(gs.dy) < TAP_THRESHOLD;
          if (isDownSwipe || isTap) {
            closePanel();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [closePanel]
  );

  const text = description && description !== '' ? description : 'No description';

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 9000, elevation: 9000 }]}>
      {!isOpen ? (
        <View
          {...handlePanResponder.panHandlers}
          style={styles.handle}
          testID="guess.enigma.handle"
        />
      ) : null}

      {isOpen ? (
        <>
          <Pressable
            accessibilityLabel="Close enigma"
            accessibilityRole="button"
            onPress={closePanel}
            {...dismissPanResponder.panHandlers}
            style={styles.scrim}
            testID="guess.enigma.scrim"
          />
          <Animated.View
            style={[styles.panel, { height: panelHeight, transform: [{ translateY }] }]}
            testID="guess.enigma.panel"
            {...dismissPanResponder.panHandlers}
          >
            <View style={styles.panelHeader}>
              <IconButton
                accessibilityLabel="Close enigma"
                color="white"
                icon="chevron-down"
                onPress={closePanel}
                size={CLOSE_ICON_SIZE}
                testID="guess.enigma.close"
              />
            </View>
            <Text style={styles.text} testID="guess.enigma.text">{text}</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor900,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: GlobalStyle.color.primaryColor900,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 9003,
    elevation: 9003,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
