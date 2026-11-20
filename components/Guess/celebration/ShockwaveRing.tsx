import { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

const DURATION_MS = 700;
const STAGGER_MS = 250;
const SCALE_START = 0;
const SCALE_END = 1.4;
const OPACITY_START = 0.5;
const OPACITY_END = 0;
const BORDER_WIDTH = 2;

interface ShockwaveRingProps {
  visible: boolean;
  color: string;
  width: number;
  height: number;
}

function useRipple(visible: boolean, size: number) {
  const scale = useRef<Animated.Value>(new Animated.Value(SCALE_START)).current;
  const opacity = useRef<Animated.Value>(new Animated.Value(OPACITY_START)).current;

  useEffect(() => {
    if (!visible || !size) return undefined;

    scale.setValue(SCALE_START);
    opacity.setValue(OPACITY_START);
    const anim = Animated.parallel([
      Animated.timing(scale, {
        toValue: SCALE_END,
        duration: DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: OPACITY_END,
        duration: DURATION_MS,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, size, scale, opacity]);

  return { scale, opacity };
}

export default function ShockwaveRing(props: ShockwaveRingProps): null | React.ReactElement {
  const { visible, color, width, height } = props;
  const size = width && height ? Math.max(width, height) : 0;
  const ringA = useRipple(visible, size);
  const ringB = useRipple(visible, size);
  const staggerHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringBAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible || !size) return undefined;
    staggerHandle.current = setTimeout(() => {
      ringB.scale.setValue(SCALE_START);
      ringB.opacity.setValue(OPACITY_START);
      ringBAnimRef.current = Animated.parallel([
        Animated.timing(ringB.scale, {
          toValue: SCALE_END,
          duration: DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(ringB.opacity, {
          toValue: OPACITY_END,
          duration: DURATION_MS,
          useNativeDriver: true,
        }),
      ]);
      ringBAnimRef.current.start();
    }, STAGGER_MS);
    return () => {
      if (staggerHandle.current) clearTimeout(staggerHandle.current);
      ringBAnimRef.current?.stop();
    };
  }, [visible, size, ringB.scale, ringB.opacity]);

  if (!visible || !size) return null;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        testID="guess.success.celebration.shockwave"
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: ringA.opacity,
            transform: [{ scale: ringA.scale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        testID="guess.success.celebration.shockwave"
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: ringB.opacity,
            transform: [{ scale: ringB.scale }],
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: BORDER_WIDTH,
  },
});
