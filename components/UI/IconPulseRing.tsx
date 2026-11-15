import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { isE2EMode } from '../../utils/e2eMode';

export type IconPulseRingPhase = 'active' | 'settle' | 'off';

const PULSE_PERIOD_MS = 700;
const REST_SCALE = 1.12;
// 24 icon + 20 header spacing (matches the gear's marginRight footprint).
const RING_SIZE = 44;
const REST_RING_SIZE = RING_SIZE * REST_SCALE;
const RING_BORDER_WIDTH = 2;
const DEFAULT_ITERATIONS = { active: 3, settle: 2 } as const;

// Real class captured at module load: jest-mock spies cannot construct ES
// classes, so suites spying on Animated.Value still get a working instance
// while the call itself stays recorded on the spied property.
const PulseValueClass = Animated.Value;

function createPulseValue(): Animated.Value {
  return Reflect.construct(Animated.Value, [1], PulseValueClass);
}

type IconPulseRingProps = {
  phase: IconPulseRingPhase;
  onLoopEnd?: () => void;
  iterations?: number;
  testID?: string;
  children?: React.ReactNode;
};

export default function IconPulseRing({ phase, onLoopEnd, iterations, testID, children }: IconPulseRingProps) {
  const pulseRef = useRef<Animated.Value | null>(null);
  if (pulseRef.current === null) {
    pulseRef.current = createPulseValue();
  }
  const pulse = pulseRef.current;

  // null = reduce-motion preference not resolved yet; the loop waits for it.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [restPhase, setRestPhase] = useState<IconPulseRingPhase | null>(null);

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
      <View testID={testID} style={styles.ringWrapper}>
        <View
          testID="groups-intro.ring.static"
          style={[
            styles.staticRing,
            {
              width: REST_RING_SIZE,
              height: REST_RING_SIZE,
              borderRadius: REST_RING_SIZE / 2,
              left: ringOffset,
              top: ringOffset,
            },
          ]}
        />
        {children}
      </View>
    );
  }

  return (
    <Animated.View testID={testID} style={[styles.ringWrapper, { transform: [{ scale: pulse }] }]}>
      <View
        testID="groups-intro.ring.pulse"
        style={[
          styles.pulseRing,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            left: 0,
            top: 0,
          },
        ]}
      />
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
  staticRing: {
    position: 'absolute',
    borderWidth: RING_BORDER_WIDTH,
    borderColor: GlobalStyle.color.secondaryColor,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: RING_BORDER_WIDTH,
    borderColor: GlobalStyle.color.secondaryColor,
  },
});
