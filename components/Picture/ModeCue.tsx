import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';
import { traceSegmentStyle } from './TraceInk';

const CUE_SIZE_RATIO = 0.38;
const CUE_STROKE_WIDTH = 4;
const SEGMENT_STAGGER_MS = 30;
const SEGMENT_DURATION_MS = 16;
const FADE_DURATION_MS = 150;
const SEGMENT_OPACITY = 0.9;

const BLOB_UNIT_POINTS: Point[] = [
  { x: -0.95, y: -0.5 },
  { x: -0.35, y: -1.0 },
  { x: 0.5, y: -0.85 },
  { x: 1.0, y: -0.1 },
  { x: 0.65, y: 0.8 },
  { x: -0.15, y: 1.0 },
  { x: -1.0, y: 0.45 },
];

type ModeCueProps = {
  imageDimensionStyle: { width: number; height: number };
};

const ModeCue: FC<ModeCueProps> = ({ imageDimensionStyle }) => {
  const { t } = useTranslation();
  const [completed, setCompleted] = useState(false);
  const segmentValues = useRef<Animated.Value[]>(
    BLOB_UNIT_POINTS.map(() => new Animated.Value(0))
  ).current;
  const fadeValue = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  const cuePoints = useMemo<Point[]>(() => {
    const centerX = imageDimensionStyle.width / 2;
    const centerY = imageDimensionStyle.height / 2;
    const radius =
      (Math.min(imageDimensionStyle.width, imageDimensionStyle.height) *
        CUE_SIZE_RATIO) /
      2;
    return BLOB_UNIT_POINTS.map((unit) => ({
      x: centerX + unit.x * radius,
      y: centerY + unit.y * radius,
    }));
  }, [imageDimensionStyle]);

  const segmentStyles = useMemo(() => {
    const styles = [];
    for (let i = 0; i < cuePoints.length; i++) {
      const style = traceSegmentStyle(
        cuePoints[i],
        cuePoints[(i + 1) % cuePoints.length],
        CUE_STROKE_WIDTH,
        GlobalStyle.color.primaryColor
      );
      if (style) {
        styles.push(style);
      }
    }
    return styles;
  }, [cuePoints]);

  useEffect(() => {
    isMountedRef.current = true;
    const reveal = Animated.stagger(
      SEGMENT_STAGGER_MS,
      segmentValues.map((value) =>
        Animated.timing(value, {
          toValue: SEGMENT_OPACITY,
          duration: SEGMENT_DURATION_MS,
          useNativeDriver: false,
        })
      )
    );
    const fadeOut = Animated.timing(fadeValue, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: false,
    });
    const sequence = Animated.sequence([reveal, fadeOut]);
    sequence.start(({ finished }) => {
      if (finished && isMountedRef.current) {
        setCompleted(true);
      }
    });
    return () => {
      isMountedRef.current = false;
      sequence.stop();
      sequence.reset();
    };
  }, [segmentValues, fadeValue]);

  if (completed) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      <Animated.View
        accessibilityLabel={t('game.picture.modeCueLabel')}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: fadeValue }]}
      />
      {segmentStyles.map((style, index) => (
        <Animated.View
          key={`cue-segment-${index}`}
          pointerEvents="none"
          style={[style, { opacity: Animated.multiply(segmentValues[index], fadeValue) }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    pointerEvents: 'none',
  },
});

export default ModeCue;
