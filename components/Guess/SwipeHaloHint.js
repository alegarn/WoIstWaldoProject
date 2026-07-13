import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

const TEST_ID = 'guess.hint.swipe-halo';

const HALO_DURATION_MS = 1600;
const HALO_FADE_IN_RATIO = 0.3;
const RING_COUNT = 3;
const RING_STAGGER_MS = Math.round(HALO_DURATION_MS / RING_COUNT);
const RING_FADE_IN_MS = Math.round(HALO_DURATION_MS * HALO_FADE_IN_RATIO);
const RING_FADE_OUT_MS = HALO_DURATION_MS - RING_FADE_IN_MS;

const RING_OPACITY_MIN = 0;
const RING_OPACITY_MAX = 0.6;
const RING_SCALE_MIN = 0.4;
const RING_SCALE_MAX = 1;

const RING_BASE_SIZE_PX = 96;
const RING_SIZE_STEP_PX = 40;
const RING_BORDER_WIDTH_PX = 3;
const RING_RADIUS_DIVISOR = 2;
const RING_CENTER_OFFSET_PERCENT = 50;
const RING_COLOR_PRIMARY = GlobalStyle.color.primaryColor;
const RING_COLOR_SECONDARY = GlobalStyle.color.secondaryColor;
const RING_KEY_PREFIX = 'swipe-halo-ring-';

const EDGE_LEFT = 'left';
const EDGE_BOTTOM = 'bottom';
const EDGES = [EDGE_LEFT, EDGE_BOTTOM];

const HINT_Z_INDEX = 9004;
const HINT_ELEVATION = 9004;

const ANIMATION_CONFIG = {
  duration: HALO_DURATION_MS,
  useNativeDriver: true,
};

function ringLayout(edge, size) {
  const centerOffset = -size / RING_RADIUS_DIVISOR;

  if (edge === EDGE_LEFT) {
    return {
      left: centerOffset,
      top: `${RING_CENTER_OFFSET_PERCENT}%`,
      marginTop: centerOffset,
    };
  }

  return {
    bottom: centerOffset,
    left: `${RING_CENTER_OFFSET_PERCENT}%`,
    marginLeft: centerOffset,
  };
}

function buildRingPulse(ring) {
  return Animated.parallel([
    Animated.sequence([
      Animated.timing(ring.opacity, {
        toValue: RING_OPACITY_MAX,
        duration: RING_FADE_IN_MS,
        useNativeDriver: true,
      }),
      Animated.timing(ring.opacity, {
        toValue: RING_OPACITY_MIN,
        duration: RING_FADE_OUT_MS,
        useNativeDriver: true,
      }),
    ]),
    Animated.timing(ring.scale, {
      toValue: RING_SCALE_MAX,
      ...ANIMATION_CONFIG,
    }),
  ]);
}

export default function SwipeHaloHint({ visible }) {
  const rings = useRef(
    EDGES.flatMap((edge) =>
      Array.from({ length: RING_COUNT }, (_, index) => ({
        edge,
        index,
        opacity: new Animated.Value(RING_OPACITY_MIN),
        scale: new Animated.Value(RING_SCALE_MIN),
      }))
    )
  ).current;

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const loops = rings.map((ring, globalIndex) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(globalIndex * RING_STAGGER_MS),
          buildRingPulse(ring),
        ])
      )
    );

    const driver = Animated.parallel(loops);
    driver.start();

    return () => {
      loops.forEach((loop) => {
        loop.stop();
        loop.reset();
      });
      rings.forEach((ring) => {
        ring.opacity.setValue(RING_OPACITY_MIN);
        ring.scale.setValue(RING_SCALE_MIN);
      });
    };
  }, [visible, rings]);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: HINT_Z_INDEX, elevation: HINT_ELEVATION }]}
      testID={TEST_ID}
    >
      {rings.map((ring, globalIndex) => {
        const size = RING_BASE_SIZE_PX + ring.index * RING_SIZE_STEP_PX;
        const color = ring.index % 2 === 0 ? RING_COLOR_PRIMARY : RING_COLOR_SECONDARY;
        return (
          <Animated.View
            key={RING_KEY_PREFIX + ring.edge + '-' + ring.index + '-' + globalIndex}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / RING_RADIUS_DIVISOR,
                borderColor: color,
                borderWidth: RING_BORDER_WIDTH_PX,
                opacity: ring.opacity,
                transform: [{ scale: ring.scale }],
                ...ringLayout(ring.edge, size),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
});
