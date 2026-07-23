import { Animated } from 'react-native';

/** Build a 2-step native-driver timing pulse: value → `to` → `from`, each over `durationMs`. */
export function pulse(
  value: Animated.Value,
  opts: { from: number; to: number; durationMs: number },
): Animated.CompositeAnimation {
  const { from, to, durationMs } = opts;
  return Animated.sequence([
    Animated.timing(value, { toValue: to, duration: durationMs, useNativeDriver: true }),
    Animated.timing(value, { toValue: from, duration: durationMs, useNativeDriver: true }),
  ]);
}
