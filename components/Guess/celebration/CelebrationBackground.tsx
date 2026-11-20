import { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';

import { pulse } from './animations';

const HALF_DIVISOR = 2;
const MIN_HALF_MS = 1;

export interface CelebrationBackgroundProps {
  visible: boolean;
  color: string;
  opacity: number;
  durationMs: number;
}

export default function CelebrationBackground(props: CelebrationBackgroundProps): null | ReactElement {
  const { visible, color, opacity: peakOpacity = 0, durationMs = 600 } = props;
  const opacity = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || peakOpacity === 0) return undefined;

    opacity.setValue(0);
    const half = Math.max(MIN_HALF_MS, Math.floor(durationMs / HALF_DIVISOR));
    const anim = pulse(opacity, { from: 0, to: peakOpacity, durationMs: half });
    anim.start();
    return () => anim.stop();
  }, [visible, peakOpacity, durationMs, opacity]);

  if (!visible || peakOpacity === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      testID="guess.success.celebration.bg"
      style={[styles.bg, { backgroundColor: color, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
