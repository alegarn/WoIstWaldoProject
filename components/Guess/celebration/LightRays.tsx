import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const SQUARE_TEST_ID = 'guess.success.celebration.rays';
const RAY_TEST_ID = 'guess.success.celebration.ray';
const RAY_WIDTH = 6;
const ROTATE_MS = 4000;
const RAY_PULSE_MS = 700;
const RAY_PULSE_STAGGER_MS = 120;
const ROOT_FADE_MS = 300;
const ROTATE_FROM_DEG = 0;
const ROTATE_TO_DEG = 360;

interface LightRaysProps {
  visible: boolean;
  color: string;
  count: number;
  size: number;
  durationMs: number;
}

export default function LightRays(props: LightRaysProps): null | React.ReactElement {
  const { visible, color, count, size, durationMs } = props;
  const rotate = useRef<Animated.Value>(new Animated.Value(ROTATE_FROM_DEG)).current;
  const rootOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;
  const rotateStr = rotate.interpolate({
    inputRange: [ROTATE_FROM_DEG, ROTATE_TO_DEG],
    outputRange: [`${ROTATE_FROM_DEG}deg`, `${ROTATE_TO_DEG}deg`],
  });

  const rayOpacities = useMemo(
    () => Array.from({ length: count }, () => new Animated.Value(0)),
    [count]
  );

  useEffect(() => {
    if (!visible || !count) return undefined;

    rotate.setValue(ROTATE_FROM_DEG);
    rayOpacities.forEach(op => op.setValue(0));

    const rotationLoop = Animated.loop(
      Animated.timing(rotate, {
        toValue: ROTATE_TO_DEG,
        duration: ROTATE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.stagger(
        RAY_PULSE_STAGGER_MS,
        rayOpacities.map(op =>
          Animated.sequence([
            Animated.timing(op, { toValue: 1, duration: RAY_PULSE_MS, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0, duration: RAY_PULSE_MS, useNativeDriver: true }),
          ])
        )
      )
    );

    rotationLoop.start();
    pulseLoop.start();
    return () => {
      rotationLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, count, rotate, rayOpacities]);

  useEffect(() => {
    if (!visible || !count || !durationMs) return undefined;

    rootOpacity.setValue(1);
    const delay = Math.max(0, durationMs - ROOT_FADE_MS);
    const fade = Animated.timing(rootOpacity, {
      toValue: 0,
      duration: ROOT_FADE_MS,
      delay,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [visible, count, durationMs, rootOpacity]);

  if (!visible || count === 0) return null;

  const safeCount = Math.max(1, Math.floor(count));
  const step = 360 / safeCount;

  return (
    <View pointerEvents="none" style={styles.fill}>
      {/* Centered via absolute-fill + justifyContent/alignItems center: simpler than
          top/left 50% + negative-margin math and stays correct if size changes. */}
      <Animated.View
        pointerEvents="none"
        testID={SQUARE_TEST_ID}
        style={[
          styles.square,
          {
            width: size,
            height: size,
            opacity: rootOpacity,
            transform: [{ rotate: rotateStr }],
          },
        ]}
      >
        {rayOpacities.map((op, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            testID={RAY_TEST_ID}
            style={[
              styles.ray,
              {
                backgroundColor: color,
                width: RAY_WIDTH,
                height: size,
                top: size / 2,
                left: size / 2 - RAY_WIDTH / 2,
                marginTop: -size / 2,
                opacity: op,
                transform: [{ rotate: `${i * step}deg` }],
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {},
  ray: {
    position: 'absolute',
  },
});
