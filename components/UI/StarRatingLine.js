import { useEffect, useMemo, useRef } from 'react';
import { Pressable, View, Text, StyleSheet, PanResponder, Animated, Dimensions } from 'react-native';

import { RATING_COLORS, RATING_LABELS } from '../../constants/rating';

const STAR_COUNT = 5;

export default function StarRatingLine({ value, onChange, widthPercent = 80, testIDPrefix, disabled, hideLabel = false, starSize = 32 }) {
  const animatedValue = useRef(new Animated.Value(value || 0)).current;

  // This slider only renders on ResultScreen, outside SwipeableCard. That avoids
  // the card PanResponder conflict in this phase. If it ever moves into a vertical
  // scroll container, switch `onMoveShouldSetPanResponderCapture` to compare
  // `Math.abs(g.dx) > Math.abs(g.dy)` so horizontal drags win without stealing
  // vertical scroll.

  const lineWidth = useMemo(
    () => Dimensions.get('window').width * (widthPercent / 100),
    [widthPercent]
  );

  const interpolatedColor = useMemo(
    () =>
      animatedValue.interpolate({
        inputRange: [0, 1, 2, 3, 4, 5],
        outputRange: RATING_COLORS.stops,
      }),
    [animatedValue]
  );

  useEffect(() => {
    animatedValue.setValue(value || 0);
  }, [animatedValue, value]);

  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const panResponder = useMemo(() => {
    if (disabled) {
      return { panHandlers: {} };
    }

    const computeValueFromMoveX = (moveX) => {
      const fraction = Math.min(Math.max(moveX / lineWidth, 0), 1);
      return Math.round(fraction * STAR_COUNT);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const next = computeValueFromMoveX(gestureState.moveX);
        if (next !== valueRef.current) {
          onChange(next);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const next = computeValueFromMoveX(gestureState.moveX);
        if (next !== valueRef.current) {
          onChange(next);
        }
      },
    });
  }, [disabled, lineWidth, onChange]);

  const rounded = Math.round(value || 0);

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => {
        const starIndex = index + 1;
        const filled = starIndex <= rounded;
        return (
          <Pressable
            key={`star-${starIndex}`}
            testID={`${testIDPrefix}.star.${starIndex}`}
            disabled={disabled}
            onPress={disabled ? undefined : () => onChange(starIndex)}
            style={styles.star}>
            <Animated.Text style={[styles.starText, { color: interpolatedColor, fontSize: starSize }]}>
              {filled ? '★' : '☆'}
            </Animated.Text>
          </Pressable>
        );
      }),
    [disabled, interpolatedColor, onChange, rounded, testIDPrefix]
  );

  return (
    <View testID={`${testIDPrefix}.line`} style={[styles.line, { width: lineWidth }]}>
      <Animated.View {...panResponder.panHandlers} style={styles.starsRow}>
        {stars}
      </Animated.View>
      {!hideLabel && (
        <Text testID={`${testIDPrefix}.label`} style={styles.label}>
          {RATING_LABELS[rounded]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  star: {
    flex: 1,
    alignItems: 'center',
    padding: 4,
  },
  starText: {
    fontSize: 32,
  },
  label: {
    marginTop: 4,
    fontSize: 14,
    color: RATING_COLORS.low,
  },
});
