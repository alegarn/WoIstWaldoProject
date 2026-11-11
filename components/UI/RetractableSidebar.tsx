import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ReactNode } from 'react';

import { GlobalStyle } from '../../constants/theme';

const SLIDE_MS = 200;
const ACTIVATE_DX = 40;
const FAIL_DY = 40;
const PANEL_WIDTH = 240;
const SLIDE_DISTANCE = PANEL_WIDTH;
const HANDLE_COLOR = '#333';
const HINT_FADE_IN_MS = 250;
const HINT_DELAY_MS = 3000;
const HINT_FADE_OUT_MS = 750;

type RetractableSidebarProps = {
  initiallyOpen?: boolean;
  accessibilityLabel: string;
  closeButtonAccessibilityLabel?: string;
  reopenHintLabel?: string;
  testIDPrefix: string;
  children: ReactNode;
};

type ReopenHintProps = {
  label: string;
  testID: string;
};

function ReopenHint({ label, testID }: ReopenHintProps) {
  const [expired, setExpired] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const sequence = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: HINT_FADE_IN_MS,
        useNativeDriver: false,
      }),
      Animated.delay(HINT_DELAY_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: HINT_FADE_OUT_MS,
        useNativeDriver: false,
      }),
    ]);
    sequence.start(({ finished }) => {
      if (finished && isMountedRef.current) {
        setExpired(true);
      }
    });
    return () => {
      isMountedRef.current = false;
      sequence.stop();
      sequence.reset();
    };
  }, [opacity]);

  if (expired) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" testID={testID} style={[styles.hint, { opacity }]}>
      <Text style={styles.hintText}>{label}</Text>
    </Animated.View>
  );
}

export default function RetractableSidebar({
  initiallyOpen = false,
  accessibilityLabel,
  closeButtonAccessibilityLabel,
  reopenHintLabel,
  testIDPrefix,
  children,
}: RetractableSidebarProps) {
  const [retracted, setRetracted] = useState(!initiallyOpen);
  const translateX = useRef(new Animated.Value(0)).current;

  const close = () => {
    setRetracted(true);
    Animated.timing(translateX, {
      toValue: SLIDE_DISTANCE,
      duration: SLIDE_MS,
      useNativeDriver: false,
    }).start();
  };

  const reopen = () => {
    setRetracted(false);
    Animated.timing(translateX, {
      toValue: 0,
      duration: SLIDE_MS,
      useNativeDriver: false,
    }).start();
  };

  const retract = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_DX, ACTIVATE_DX])
    .failOffsetY([-FAIL_DY, FAIL_DY])
    .onEnd((event, success) => {
      if (!success) return;
      const dx = Math.abs(event.translationX);
      const dy = Math.abs(event.translationY);
      if (dx >= ACTIVATE_DX && dx > dy) {
        close();
      }
    });

  const reopenPan = retracted
    ? Gesture.Pan()
        .activeOffsetX([-ACTIVATE_DX, ACTIVATE_DX])
        .failOffsetY([-FAIL_DY, FAIL_DY])
        .onEnd((event, success) => {
          if (!success) return;
          const dx = Math.abs(event.translationX);
          const dy = Math.abs(event.translationY);
          if (dx >= ACTIVATE_DX && dx > dy && event.translationX < 0) {
            reopen();
          }
        })
    : null;

  return (
    <View
      testID={`${testIDPrefix}.container`}
      style={[StyleSheet.absoluteFill, styles.layer]}
      pointerEvents="box-none">
      <GestureDetector gesture={retract}>
        <Animated.View
          testID={`${testIDPrefix}.panel`}
          style={[styles.panel, { transform: [{ translateX }] }]}
          accessibilityLabel={accessibilityLabel}>
          {children}
          <Pressable
            testID={`${testIDPrefix}.handle-close`}
            style={styles.closeButton}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={closeButtonAccessibilityLabel ?? accessibilityLabel}>
            <Ionicons name={"chevron-forward"} color={"white"} size={20} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
      {retracted && reopenPan && (
        <GestureDetector gesture={reopenPan}>
          <Pressable
            testID={`${testIDPrefix}.handle-open`}
            style={styles.handle}
            onPress={reopen}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ expanded: !retracted }}
          />
        </GestureDetector>
      )}
      {retracted && reopenHintLabel && (
        <ReopenHint testID={`${testIDPrefix}.hint-reopen`} label={reopenHintLabel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: GlobalStyle.color.onSurface,
  },
  handle: {
    position: 'absolute',
    right: 0,
    top: '50%',
    width: 16,
    height: 64,
    backgroundColor: HANDLE_COLOR,
  },
  closeButton: {
    position: 'absolute',
    left: -28,
    top: '50%',
    marginTop: -22,
    width: 28,
    height: 44,
    backgroundColor: HANDLE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    position: 'absolute',
    right: 24,
    top: '50%',
    backgroundColor: HANDLE_COLOR,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hintText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
