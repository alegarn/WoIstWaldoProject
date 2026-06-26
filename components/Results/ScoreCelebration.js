import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const GOLD = '#FFD700';

export default function ScoreCelebration({
  points = 1,
  testIDPrefix = 'result.celebration',
}) {
  const scoreScale = useRef(new Animated.Value(0)).current;
  const leftFavorScale = useRef(new Animated.Value(0)).current;
  const leftFavorTranslateY = useRef(new Animated.Value(0)).current;
  const rightFavorScale = useRef(new Animated.Value(0)).current;
  const rightFavorTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const scorePop = Animated.spring(scoreScale, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    });

    const leftFavorPop = Animated.parallel([
      Animated.spring(leftFavorScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(leftFavorTranslateY, {
        toValue: -6,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    const rightFavorPop = Animated.parallel([
      Animated.spring(rightFavorScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(rightFavorTranslateY, {
        toValue: -6,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    const animation = Animated.parallel([
      scorePop,
      leftFavorPop,
      rightFavorPop,
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    scoreScale,
    leftFavorScale,
    leftFavorTranslateY,
    rightFavorScale,
    rightFavorTranslateY,
  ]);

  const pointsLabel = `+${points} point${points === 1 ? '' : 's'}`;

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <Animated.Text
          testID={`${testIDPrefix}.score`}
          style={[
            styles.score,
            {
              opacity: scoreScale,
              transform: [{ scale: scoreScale }],
            },
          ]}
        >
          {pointsLabel}
        </Animated.Text>

        <View
          testID={`${testIDPrefix}.favors`}
          style={styles.favors}
          pointerEvents="none"
        >
          <Animated.Text
            style={[
              styles.favor,
              {
                opacity: leftFavorScale,
                transform: [
                  { scale: leftFavorScale },
                  { translateY: leftFavorTranslateY },
                ],
              },
            ]}
          >
            🎉
          </Animated.Text>
          <Animated.Text
            style={[
              styles.favor,
              {
                opacity: rightFavorScale,
                transform: [
                  { scale: rightFavorScale },
                  { translateY: rightFavorTranslateY },
                ],
              },
            ]}
          >
            🎊
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 12,
  },
  favors: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  favor: {
    fontSize: 28,
  },
  score: {
    color: GOLD,
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
