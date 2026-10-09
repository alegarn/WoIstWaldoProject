import { useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import {
  isDrawableOutline,
  normalizeOutline,
  simplifyOutline,
  type Point,
} from '../../utils/shapeGeometry';

type ImageDimensionStyle = { width: number; height: number };

type ShapeCanvasProps = {
  imageDimensionStyle: ImageDimensionStyle;
  outline?: Point[] | null;
  onOutlineChange?: (outline: Point[] | null) => void;
  disabled?: boolean;
};

const OUTLINE_STROKE_WIDTH = 2;

// D2 outline technique: a polyline becomes N−1 thin rotated View segments
// between consecutive vertices (plus the auto-close segment) — no svg/canvas
// dependency. Each segment is a horizontal bar centered on its midpoint,
// rotated around the view center to span start→end exactly.
function segmentStyle(start: Point, end: Point) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return null;
  }
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return {
    position: 'absolute' as const,
    left: (start.x + end.x) / 2 - length / 2,
    top: (start.y + end.y) / 2 - OUTLINE_STROKE_WIDTH / 2,
    width: length,
    height: OUTLINE_STROKE_WIDTH,
    borderRadius: OUTLINE_STROKE_WIDTH / 2,
    backgroundColor: GlobalStyle.color.primaryColor,
    transform: [{ rotate: `${angle}deg` }],
  };
}

// px-space collection owner: raw pointer coordinates can leave the image
// rect, so every collected point is clamped to [0, w] × [0, h] before it
// reaches the trace, the pipeline, or storage.
function clampToImage(point: Point, imageWidth: number, imageHeight: number): Point {
  return {
    x: Math.min(Math.max(point.x, 0), imageWidth),
    y: Math.min(Math.max(point.y, 0), imageHeight),
  };
}

function segmentsBetween(points: Point[]) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const style = segmentStyle(points[i], points[i + 1]);
    if (style) {
      segments.push(<View key={`segment-${i}`} style={style} />);
    }
  }
  return segments;
}

const ShapeCanvas: FC<ShapeCanvasProps> = ({
  imageDimensionStyle,
  outline,
  onOutlineChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [rawPoints, setRawPoints] = useState<Point[]>([]);
  const [degenerate, setDegenerate] = useState(false);
  const rawPointsRef = useRef<Point[]>([]);

  const { width: imageWidth, height: imageHeight } = imageDimensionStyle;

  const storedSegments = useMemo(() => {
    if (!outline || outline.length === 0) {
      return [];
    }
    const pixelPoints = outline.map((point) => ({
      x: point.x * imageWidth,
      y: point.y * imageHeight,
    }));
    return segmentsBetween(pixelPoints);
  }, [outline, imageWidth, imageHeight]);

  const liveSegments = useMemo(() => {
    if (rawPoints.length < 2) {
      return [];
    }
    const segments = segmentsBetween(rawPoints);
    if (rawPoints.length >= 3) {
      const preview = segmentStyle(
        rawPoints[rawPoints.length - 1],
        rawPoints[0]
      );
      if (preview) {
        segments.push(<View key="segment-autoclose-preview" style={preview} />);
      }
    }
    return segments;
  }, [rawPoints]);

  // Storage pipeline owner: raw px → simplify → normalize → round to 3
  // decimals before leaving the component, so every consumer (hide storage,
  // guess match, e2e shims) sees the same normalized [0,1] space.
  const finalizeStroke = () => {
    const points = rawPointsRef.current;
    rawPointsRef.current = [];
    setRawPoints([]);
    if (points.length < 2) {
      return;
    }
    const simplified = simplifyOutline(points, imageWidth, imageHeight);
    const normalized = normalizeOutline(simplified, imageWidth, imageHeight);
    const drawable = isDrawableOutline(normalized);
    setDegenerate(!drawable);
    onOutlineChange?.(drawable ? normalized : null);
  };

  const drawPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .onStart((event) => {
          setDegenerate(false);
          const point = clampToImage(
            { x: event.x, y: event.y },
            imageWidth,
            imageHeight
          );
          rawPointsRef.current = [point];
          setRawPoints([point]);
        })
        .onUpdate((event) => {
          const point = clampToImage(
            { x: event.x, y: event.y },
            imageWidth,
            imageHeight
          );
          rawPointsRef.current = [...rawPointsRef.current, point];
          setRawPoints(rawPointsRef.current);
        })
        .onEnd(() => {
          finalizeStroke();
        }),
    [disabled, imageWidth, imageHeight, onOutlineChange]
  );

  return (
    <GestureDetector gesture={drawPan}>
      <View style={[StyleSheet.absoluteFill, styles.surface]} testID="game.picture.shape-surface">
        {storedSegments.length > 0 && (
          <View
            style={[StyleSheet.absoluteFill, styles.layer]}
            testID="game.picture.shape-outline"
          >
            {storedSegments}
          </View>
        )}
        {liveSegments.length > 0 && (
          <View style={[StyleSheet.absoluteFill, styles.layer]} testID="game.picture.shape-trace">
            {liveSegments}
          </View>
        )}
        {degenerate && (
          <Text style={styles.prompt}>{t('game.picture.shapeTooSimple')}</Text>
        )}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  surface: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  layer: {
    pointerEvents: 'none',
  },
  prompt: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    paddingHorizontal: 10,
    color: GlobalStyle.color.onSurface,
    backgroundColor: GlobalStyle.color.scrim,
    borderRadius: 6,
    overflow: 'hidden',
    textAlign: 'center',
  },
});

export default ShapeCanvas;
