import { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet, Animated, Pressable } from 'react-native';

import { RATING_COLORS } from '../../constants/rating';

const STAR_COUNT = 5;

export default function StarRatingBadge({ value, ratingsCount, size = 30, onPress, testIDPrefix }) {
  const animatedValue = useRef(new Animated.Value(value || 0)).current;

  const interpolatedColor = useMemo(
    () =>
      animatedValue.interpolate({
        inputRange: [0, STAR_COUNT],
        outputRange: [RATING_COLORS.low, RATING_COLORS.high],
      }),
    [animatedValue]
  );

  useEffect(() => {
    animatedValue.setValue(value || 0);
  }, [animatedValue, value]);

  const isUnrated = ratingsCount === 0;

  return (
    <Pressable
      onPress={onPress}
      testID={`${testIDPrefix}.badge`}
      style={[styles.badge, { width: size, height: size }]}>
      {isUnrated ? (
        <Text testID={`${testIDPrefix}.badge.unknown`} style={styles.unknown}>
          ?
        </Text>
      ) : (
        <Animated.Text style={[styles.star, { color: interpolatedColor }]}>
          ★
        </Animated.Text>
      )}
      <Text testID={`${testIDPrefix}.badge.value`} style={styles.hiddenValue}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknown: {
    fontSize: 18,
    color: RATING_COLORS.low,
  },
  star: {
    fontSize: 24,
  },
  hiddenValue: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
});
