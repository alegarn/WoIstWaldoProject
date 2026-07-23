import { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { pulse } from './animations';

const PEAK_OPACITY = 0.8;
const DURATION_MS = 220;
const HALF_DIVISOR = 2;
const MIN_HALF_MS = 1;
const FLASH_COLOR = '#FFFFFF';

interface ChromaticFlashProps {
  visible: boolean;
}

export default function ChromaticFlash(props: ChromaticFlashProps): null | React.ReactElement {
  const { visible } = props;
  const opacity = useRef<Animated.Value>(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) return undefined;

    opacity.setValue(0);
    const half = Math.max(MIN_HALF_MS, Math.floor(DURATION_MS / HALF_DIVISOR));
    const anim = pulse(opacity, { from: 0, to: PEAK_OPACITY, durationMs: half });
    animRef.current = anim;
    anim.start();
    return () => {
      animRef.current?.stop();
    };
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      testID="guess.success.celebration.flash"
      style={[styles.flash, { opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: FLASH_COLOR,
  },
});
