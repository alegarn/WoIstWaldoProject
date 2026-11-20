import { useRef, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { ReactElement } from 'react';

import type { ParticleMode } from '../../../constants/streakCelebration';

const TEST_ID = 'guess.success.celebration.particle';
const MIN_SIZE = 4;
const MAX_SIZE = 10;
const MIN_DUR_MS = 400;
const DUR_CEIL_FACTOR = 0.6;
const FADE_IN_FRACTION = 0.25;
const MIN_FADE_MS = 60;
const ROTATE_MAX_DEG = 360;
const EMBER_X_SWAY = 0.2;
const EMBER_RISE_MIN = 0.3;
const EMBER_RISE_RANGE = 0.4;
const EMBER_SPAWN_Y_MIN = 0.6;
const EMBER_SPAWN_Y_RANGE = 0.3;
const RAIN_FALL_MIN = 0.4;
const RAIN_FALL_RANGE = 0.4;
const RAIN_X_SWAY = 0.1;
const CONFETTI_DRIFT_MIN = 0.5;
const CONFETTI_DRIFT_RANGE = 0.5;

const defaultRng: () => number = Math.random;

export type ParticleSeed = {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  size: number;
  dur: number;
  delay: number;
  rotateTo: number;
};

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick a per-particle animation duration within a safe sub-range of durationMs.
// Returned dur always satisfies dur <= durationMs * 0.6 (clamped to durationMs).
export function pickDuration(durationMs: number, rng: () => number = defaultRng): number {
  const ceil = Math.floor(durationMs * DUR_CEIL_FACTOR);
  const hi = Math.min(ceil, durationMs);
  const lo = Math.min(MIN_DUR_MS, hi);
  return randInt(rng, lo, hi);
}

// Pick a delay in [0, durationMs - dur] so dur + delay <= durationMs by construction.
export function pickDelay(durationMs: number, dur: number, rng: () => number = defaultRng): number {
  const remaining = Math.max(0, durationMs - dur);
  return randInt(rng, 0, remaining);
}

// Seed a single particle's trajectory. Pure: same rng sequence => same particle.
// Mode selects drift vector sign: ember rises, rain falls, confetti bursts from a corner.
export function seedParticle(
  mode: ParticleMode,
  width: number,
  height: number,
  durationMs: number,
  rng: () => number = defaultRng,
): ParticleSeed {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const size = randInt(rng, MIN_SIZE, MAX_SIZE);
  const dur = pickDuration(durationMs, rng);
  const delay = pickDelay(durationMs, dur, rng);
  const rotateTo = randInt(rng, 0, ROTATE_MAX_DEG);

  if (mode === 'ember') {
    return {
      x0: randInt(rng, 0, w - 1),
      y0: Math.floor(h * (EMBER_SPAWN_Y_MIN + rng() * EMBER_SPAWN_Y_RANGE)),
      dx: Math.floor((rng() - 0.5) * w * EMBER_X_SWAY),
      dy: -Math.floor(h * (EMBER_RISE_MIN + rng() * EMBER_RISE_RANGE)),
      size, dur, delay, rotateTo,
    };
  }

  if (mode === 'rain') {
    return {
      x0: randInt(rng, 0, w - 1),
      y0: -size,
      dx: Math.floor((rng() - 0.5) * w * RAIN_X_SWAY),
      dy: Math.floor(h * (RAIN_FALL_MIN + rng() * RAIN_FALL_RANGE)),
      size, dur, delay, rotateTo,
    };
  }

  // confetti: pick a corner, drift outward toward/through center.
  const corner = Math.floor(rng() * 4);
  const cx = (corner % 2) * w;
  const cy = Math.floor(corner / 2) * h;
  const driftFactor = CONFETTI_DRIFT_MIN + rng() * CONFETTI_DRIFT_RANGE;
  return {
    x0: cx,
    y0: cy,
    dx: Math.floor((w / 2 - cx) * driftFactor),
    dy: Math.floor((h / 2 - cy) * driftFactor),
    size, dur, delay, rotateTo,
  };
}

interface ParticleFieldProps {
  visible: boolean;
  count: number;
  color: string;
  mode: ParticleMode;
  width: number;
  height: number;
  durationMs: number;
}

export default function ParticleField(props: ParticleFieldProps): null | ReactElement {
  const { visible, count, color, mode, width, height, durationMs } = props;
  const [particles, setParticles] = useState<Array<ParticleSeed & {
    x: Animated.Value;
    y: Animated.Value;
    opacity: Animated.Value;
    rotate: Animated.Value;
  }>>([]);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible || count === 0) {
      setParticles([]);
      animRef.current = null;
      return undefined;
    }

    const n = Math.max(0, Math.floor(count));
    const seeded = Array.from({ length: n }, () => {
      const seed = seedParticle(mode, width, height, durationMs);
      return {
        ...seed,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(0),
        rotate: new Animated.Value(0),
      };
    });
    setParticles(seeded);

    const animations = seeded.map(p => {
      const fadeInMs = Math.max(MIN_FADE_MS, Math.floor(p.dur * FADE_IN_FRACTION));
      const fadeOutMs = Math.max(MIN_FADE_MS, p.dur - fadeInMs);
      const moveX = Animated.timing(p.x, {
        toValue: p.dx,
        duration: p.dur,
        useNativeDriver: true,
      });
      const moveY = Animated.timing(p.y, {
        toValue: p.dy,
        duration: p.dur,
        useNativeDriver: true,
      });
      const fade = Animated.sequence([
        Animated.timing(p.opacity, {
          toValue: 1,
          duration: fadeInMs,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: fadeOutMs,
          useNativeDriver: true,
        }),
      ]);
      const tracks = [moveX, moveY, fade];
      if (mode === 'confetti' || mode === 'rain') {
        tracks.push(
          Animated.timing(p.rotate, {
            toValue: p.rotateTo,
            duration: p.dur,
            useNativeDriver: true,
          })
        );
      }
      return Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel(tracks),
      ]);
    });

    const combined = Animated.parallel(animations);
    animRef.current = combined;
    combined.start();

    return () => {
      animRef.current?.stop();
      animRef.current = null;
    };
  }, [visible, count, mode, width, height, durationMs]);

  if (!visible || count === 0) return null;

  const withRotation = mode === 'confetti' || mode === 'rain';

  return (
    <View pointerEvents="none" style={styles.root}>
      {particles.map((p, i) => {
        const base = [{ translateX: p.x }, { translateY: p.y }];
        const rotate = withRotation
          ? [{
              rotate: p.rotate.interpolate({
                inputRange: [0, ROTATE_MAX_DEG],
                outputRange: ['0deg', `${ROTATE_MAX_DEG}deg`],
              }),
            }]
          : [];
        const transform = [...base, ...rotate];
        return (
          <Animated.View
            key={i}
            testID={TEST_ID}
            style={[
              styles.particle,
              {
                left: p.x0,
                top: p.y0,
                width: p.size,
                height: p.size,
                backgroundColor: color,
                opacity: p.opacity,
                transform,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
  },
});
