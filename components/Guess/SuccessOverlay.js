import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import { GlobalStyle } from '../../constants/theme';

// Single source of truth for the speed-bonus color (spokes, chrono, pill).
const SPEED_COLOR = GlobalStyle.color.win;
const SPRING_FRICTION_BASE = 4;
const SPRING_TENSION_BASE = 40;
const SPRING_FRICTION_FAST = 3;
const SPRING_TENSION_FAST = 60;
const SPEED_SPOKE_COUNT = 8;
const SPOKE_LENGTH = 36;
const SPOKE_WIDTH = 6;
const SPOKE_RADIUS = 80;
const BURST_STAGGER_MS = 30;
const BURST_IN_MS = 150;
const BURST_OUT_MS = 350;
const FADE_OUT_MS = 600;
const BADGE_DELAY_MS = 120;
const BURST_SPIN_DEG = 45;
const CHRONO_ICON = 'timer-outline';
const CHRONO_SIZE = 22;

export default function SuccessOverlay({ visible, onDone, multiplier = 1, points = 1 }) {
  const isSpeedBonus = multiplier > 1;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const burstRotation = useRef(new Animated.Value(0)).current;
  const burstRotateStr = burstRotation.interpolate({
    inputRange: [0, BURST_SPIN_DEG],
    outputRange: ['0deg', `${BURST_SPIN_DEG}deg`],
  });
  const spokes = useRef(
    Array.from({ length: SPEED_SPOKE_COUNT }, () => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const animRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;

    scale.setValue(0);
    opacity.setValue(1);
    if (isSpeedBonus) {
      spokes.forEach(({ scale: s, opacity: o }) => {
        s.setValue(0);
        o.setValue(0);
      });
      badgeScale.setValue(0);
      burstRotation.setValue(0);
    }

    const friction = isSpeedBonus ? SPRING_FRICTION_FAST : SPRING_FRICTION_BASE;
    const tension = isSpeedBonus ? SPRING_TENSION_FAST : SPRING_TENSION_BASE;

    const baseAnim = Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction, tension, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }),
    ]);

    let animation = baseAnim;
    if (isSpeedBonus) {
      const burst = Animated.stagger(
        BURST_STAGGER_MS,
        spokes.map(({ scale: s, opacity: o }) =>
          Animated.sequence([
            Animated.parallel([
              Animated.spring(s, { toValue: 1, friction: SPRING_FRICTION_FAST, tension: SPRING_TENSION_FAST, useNativeDriver: true }),
              Animated.timing(o, { toValue: 1, duration: BURST_IN_MS, useNativeDriver: true }),
            ]),
            Animated.timing(o, { toValue: 0, duration: BURST_OUT_MS, useNativeDriver: true }),
          ])
        )
      );
      const badgePopIn = Animated.sequence([
        Animated.delay(BADGE_DELAY_MS),
        Animated.spring(badgeScale, { toValue: 1, friction: SPRING_FRICTION_FAST, tension: SPRING_TENSION_FAST, useNativeDriver: true }),
      ]);
      const burstSpin = Animated.timing(burstRotation, {
        toValue: BURST_SPIN_DEG,
        duration: BURST_IN_MS + BURST_OUT_MS + (SPEED_SPOKE_COUNT * BURST_STAGGER_MS),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation = Animated.parallel([baseAnim, burst, badgePopIn, burstSpin]);
    }

    animRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        onDoneRef.current?.();
      }
    });

    return () => {
      animRef.current?.stop();
    };
  }, [visible, isSpeedBonus, scale, opacity, spokes, badgeScale, burstRotation]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none" testID="guess.success.overlay">
      <Animated.View style={[styles.panel, { transform: [{ scale }], opacity }]}>
        {isSpeedBonus && (
          <Animated.View
            style={[styles.burst, { transform: [{ rotate: burstRotateStr }] }]}
            pointerEvents="none"
            testID="guess.success.speed-burst"
          >
            {spokes.map((spoke, i) => (
              <View
                key={i}
                style={[styles.spokeHub, { transform: [{ rotate: `${i * (360 / SPEED_SPOKE_COUNT)}deg` }] }]}
              >
                <Animated.View
                  style={[
                    styles.spoke,
                    {
                      opacity: spoke.opacity,
                      transform: [{ scale: spoke.scale }],
                    },
                  ]}
                />
              </View>
            ))}
          </Animated.View>
        )}
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.label}>{`+${points}`}</Text>
        {isSpeedBonus && (
          <Animated.View
            testID="guess.success.speed-badge"
            style={[styles.speedBadge, { transform: [{ scale: badgeScale }] }]}
          >
            <Ionicons
              name={CHRONO_ICON}
              size={CHRONO_SIZE}
              color={SPEED_COLOR}
              style={styles.chrono}
              testID="guess.success.speed-chrono"
            />
            <View style={styles.multiplierPill}>
              <Text style={styles.multiplierText}>{`×${multiplier}`}</Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  panel: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 24,
  },
  burst: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spokeHub: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  spoke: {
    width: SPOKE_WIDTH,
    height: SPOKE_LENGTH,
    backgroundColor: SPEED_COLOR,
    borderRadius: SPOKE_WIDTH / 2,
    marginTop: -(SPOKE_RADIUS + SPOKE_LENGTH),
  },
  checkmark: { fontSize: 96, fontWeight: 'bold', color: '#FFFFFF' },
  label: { fontSize: 36, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
  speedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  chrono: { marginRight: 6 },
  multiplierPill: { borderWidth: 2, borderColor: SPEED_COLOR, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'transparent' },
  multiplierText: { fontSize: 20, fontWeight: 'bold', color: SPEED_COLOR },
});
