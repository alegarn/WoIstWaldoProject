import type { ReactNode } from 'react';
import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

const DEFAULT_INTENSITY = 0;
const DEFAULT_DURATION_MS = 300;
const STEP_COUNT = 6;
const MIN_STEP_MS = 1;

const STEP_PATTERN = [
  { axis: 'x', value: 1 },
  { axis: 'y', value: 1 },
  { axis: 'x', value: -1 },
  { axis: 'y', value: -1 },
  { axis: 'x', value: 0 },
  { axis: 'y', value: 0 },
] as const;

export interface ScreenShakeProps {
  active: boolean;
  intensity: number;
  durationMs?: number;
  children: ReactNode;
}

export default function ScreenShake({
  active,
  intensity = DEFAULT_INTENSITY,
  children,
  durationMs = DEFAULT_DURATION_MS,
}: ScreenShakeProps): React.ReactElement {
  const translateX = useRef<Animated.Value>(new Animated.Value(0)).current;
  const translateY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active || intensity === 0) return undefined;

    const stepDuration = Math.max(MIN_STEP_MS, Math.floor(durationMs / STEP_COUNT));
    const steps = STEP_PATTERN.map(({ axis, value }) => {
      const target = axis === 'x' ? translateX : translateY;
      return Animated.timing(target, {
        toValue: value * intensity,
        duration: stepDuration,
        useNativeDriver: true,
      });
    });

    const sequence = Animated.sequence(steps);
    animRef.current = sequence;
    sequence.start();
    return () => {
      animRef.current?.stop();
    };
  }, [active, intensity, durationMs, translateX, translateY]);

  return (
    <Animated.View
      testID="guess.success.celebration.shake"
      style={{ transform: [{ translateX }, { translateY }] }}
    >
      {children}
    </Animated.View>
  );
}
