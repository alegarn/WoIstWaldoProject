import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { PULSE_PERIOD_MS } from '../../constants/groupsIntro';
import { isE2EMode } from '../../utils/e2eMode';

export type IconPulseRingPhase = 'active' | 'settle' | 'off';

const REST_SCALE = 1.12;
// Glyph footprint only: 24 icon + 4 breathing room each side. Header spacing
// lives OUTSIDE the ring (callers use wrapperStyle), so the ring centers on
// the glyph itself.
const RING_SIZE = 32;
const REST_RING_SIZE = RING_SIZE * REST_SCALE;
const RING_BORDER_WIDTH = 2;
const DEFAULT_ITERATIONS = { active: 3, settle: 2 } as const;

type IconPulseRingProps = {
  phase: IconPulseRingPhase;
  onLoopEnd?: () => void;
  iterations?: number;
  testID?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// The accent circle itself: both the static and the pulse branch render the
// same geometry shape, only sized/offset differently. testIDs stay distinct
// so tests can tell which branch is showing.
function renderRing(testID: string, size: number, offset: number) {
  return (
    <View
      testID={testID}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, left: offset, top: offset }]}
    />
  );
}

export default function IconPulseRing({
  phase,
  onLoopEnd,
  iterations,
  testID,
  wrapperStyle,
  children,
}: IconPulseRingProps) {
  const pulseRef = useRef<Animated.Value | null>(null);
  if (pulseRef.current === null) {
    pulseRef.current = new Animated.Value(1);
  }
  const pulse = pulseRef.current;

  // null = reduce-motion preference not resolved yet; the loop waits for it.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [restPhase, setRestPhase] = useState<IconPulseRingPhase | null>(null);

  // 'off' has no loop (never animated), but shares 'active' iterations should
  // a loop ever arm while off — the branch below returns before that point.
  const resolvedIterations = iterations ?? DEFAULT_ITERATIONS[phase === 'settle' ? 'settle' : 'active'];

  useEffect(() => {
    if (phase === 'off') {
      return undefined;
    }

    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'off' || reduceMotion === null || reduceMotion || isE2EMode()) {
      return undefined;
    }

    pulse.setValue(1);

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: REST_SCALE,
        duration: PULSE_PERIOD_MS,
        useNativeDriver: true,
      }),
      { iterations: resolvedIterations }
    );

    loop.start(({ finished }) => {
      if (finished) {
        setRestPhase(phase);
        onLoopEnd?.();
      }
    });

    return () => loop.stop();
  }, [phase, reduceMotion, pulse, resolvedIterations, onLoopEnd]);

  if (phase === 'off') {
    return <>{children}</>;
  }

  if (reduceMotion === true || restPhase === phase) {
    const ringOffset = (RING_SIZE - REST_RING_SIZE) / 2;

    return (
      <View testID={testID} style={[styles.ringWrapper, wrapperStyle]}>
        {renderRing('groups-intro.ring.static', REST_RING_SIZE, ringOffset)}
        {children}
      </View>
    );
  }

  return (
    <Animated.View testID={testID} style={[styles.ringWrapper, wrapperStyle, { transform: [{ scale: pulse }] }]}>
      {renderRing('groups-intro.ring.pulse', RING_SIZE, 0)}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: RING_BORDER_WIDTH,
    borderColor: GlobalStyle.color.secondaryColor,
  },
});
