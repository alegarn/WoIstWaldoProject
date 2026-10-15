import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { ReactNode } from 'react';

import { GlobalStyle } from '../../constants/theme';

const SLIDE_MS = 200;
const ACTIVATE_DX = 40;
const FAIL_DY = 40;
const PANEL_WIDTH = 240;
const SLIDE_DISTANCE = PANEL_WIDTH;
const HANDLE_COLOR = '#333';

type RetractableSidebarProps = {
  initiallyOpen?: boolean;
  accessibilityLabel: string;
  testIDPrefix: string;
  children: ReactNode;
};

export default function RetractableSidebar({
  initiallyOpen = false,
  accessibilityLabel,
  testIDPrefix,
  children,
}: RetractableSidebarProps) {
  const [retracted, setRetracted] = useState(!initiallyOpen);
  const translateX = useRef(new Animated.Value(0)).current;

  const retract = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_DX, ACTIVATE_DX])
    .failOffsetY([-FAIL_DY, FAIL_DY])
    .onEnd((event, success) => {
      if (!success) return;
      const dx = Math.abs(event.translationX);
      const dy = Math.abs(event.translationY);
      if (dx >= ACTIVATE_DX && dx > dy) {
        setRetracted(true);
        Animated.timing(translateX, {
          toValue: SLIDE_DISTANCE,
          duration: SLIDE_MS,
          useNativeDriver: false,
        }).start();
      }
    });

  const reopen = () => {
    setRetracted(false);
    Animated.timing(translateX, {
      toValue: 0,
      duration: SLIDE_MS,
      useNativeDriver: false,
    }).start();
  };

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
        </Animated.View>
      </GestureDetector>
      {retracted && (
        <Pressable
          testID={`${testIDPrefix}.handle-open`}
          style={styles.handle}
          onPress={reopen}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: !retracted }}
        />
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
});
