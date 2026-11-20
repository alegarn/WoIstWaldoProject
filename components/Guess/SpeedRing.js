import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { SPEED_WINDOW_MS } from '../../utils/speedMultiplier';

const RING_HALF_ROTATION_DEG = 180;
const RING_SECOND_HALF_START = 0.5;
const RING_START_DEPLETION = 0;
const RING_FULL_DEPLETION = 1;

export default function SpeedRing({
  size,
  durationMs = SPEED_WINDOW_MS,
  color = GlobalStyle.color.primaryColor,
  strokeWidth = 3,
  active = true,
  testID = 'guess.speed-ring',
}) {
  const depletion = useRef(new Animated.Value(RING_START_DEPLETION)).current;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const timing = Animated.timing(depletion, {
      toValue: RING_FULL_DEPLETION,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    timing.start();
    return () => {
      timing.stop();
    };
  }, [active, durationMs, depletion]);

  if (size <= 0 || durationMs <= 0) {
    return null;
  }

  const halfSize = size / 2;

  const firstHalfRotate = depletion.interpolate({
    inputRange: [RING_SECOND_HALF_START, RING_FULL_DEPLETION],
    outputRange: ['0deg', `${RING_HALF_ROTATION_DEG}deg`],
    extrapolate: 'clamp',
  });

  const secondHalfRotate = depletion.interpolate({
    inputRange: [RING_START_DEPLETION, RING_FULL_DEPLETION],
    outputRange: ['0deg', `${RING_HALF_ROTATION_DEG}deg`],
  });

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: halfSize,
    borderWidth: strokeWidth,
    borderColor: color,
  };

  return (
    <View testID={testID} style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.halfClip, { width: halfSize, height: size }]}>
        <Animated.View
          style={[
            styles.innerCircle,
            styles.innerLeft,
            circleStyle,
            { transform: [{ rotate: firstHalfRotate }] },
          ]}
        />
      </View>
      <View style={[styles.halfClip, { width: halfSize, height: size }]}>
        <Animated.View
          style={[
            styles.innerCircle,
            styles.innerRight,
            circleStyle,
            { transform: [{ rotate: secondHalfRotate }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  halfClip: {
    overflow: 'hidden',
  },
  innerCircle: {
    position: 'absolute',
    top: 0,
  },
  innerLeft: {
    left: 0,
  },
  innerRight: {
    right: 0,
  },
});
