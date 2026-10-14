import { memo, useMemo } from 'react';
import type { FC } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';

export const TRACE_INK_TEST_ID = 'game.picture.trace-ink';

const DEFAULT_STROKE_WIDTH = 2;

export type TraceSegmentStyle = {
  position: 'absolute';
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
  backgroundColor: string;
  transform: [{ rotate: string }];
};

/**
 * Builds the rotated-bar style spanning `start`→`end`: a horizontal bar
 * centered on the segment midpoint, rotated around the view center. Returns
 * null for zero-length segments (nothing to draw). Shared single source of
 * the polyline→bar math for TraceInk bars, ShapeCanvas's auto-close preview,
 * and any other thin-line consumer.
 */
export function traceSegmentStyle(
  start: Point,
  end: Point,
  strokeWidth: number = DEFAULT_STROKE_WIDTH,
  color: string = GlobalStyle.color.primaryColor
): TraceSegmentStyle | null {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return null;
  }
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return {
    position: 'absolute',
    left: (start.x + end.x) / 2 - length / 2,
    top: (start.y + end.y) / 2 - strokeWidth / 2,
    width: length,
    height: strokeWidth,
    borderRadius: strokeWidth / 2,
    backgroundColor: color,
    transform: [{ rotate: `${angle}deg` }],
  };
}

/**
 * Value-equality gate for memoized bars: parent renders rebuild style
 * objects, so identity comparison would re-render every bar on each commit.
 * Equal-VALUE styles skip the bar render entirely.
 */
export function areSegmentStylesEqual(
  prev: TraceSegmentStyle | null | undefined,
  next: TraceSegmentStyle | null | undefined
): boolean {
  if (prev === next) {
    return true;
  }
  if (!prev || !next) {
    return false;
  }
  return (
    prev.position === next.position &&
    prev.left === next.left &&
    prev.top === next.top &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.borderRadius === next.borderRadius &&
    prev.backgroundColor === next.backgroundColor &&
    prev.transform?.[0]?.rotate === next.transform?.[0]?.rotate
  );
}

type SegmentBarProps = { style: TraceSegmentStyle };

/**
 * React.memo props adapter delegating to the style value-comparison.
 */
export function areSegmentPropsEqual(
  prev: SegmentBarProps,
  next: SegmentBarProps
): boolean {
  return areSegmentStylesEqual(prev?.style, next?.style);
}

export const TraceInkSegment = memo<SegmentBarProps>(
  ({ style }) => <View style={style} />,
  areSegmentPropsEqual
);

type TraceInkProps = {
  points: Point[];
  strokeWidth?: number;
  color?: string;
  testID?: string;
  /**
   * Caller-composed extra bar rendered after the consecutive segments
   * (ShapeCanvas's auto-close preview). TraceInk itself never closes the
   * polyline.
   */
  previewStyle?: TraceSegmentStyle | ViewStyle | null;
};

// Thin polyline renderer: N points become N−1 memoized rotated View bars.
// Pure presentational — no gesture, no judgment, no auto-close.
const TraceInk: FC<TraceInkProps> = ({
  points,
  strokeWidth,
  color,
  testID = TRACE_INK_TEST_ID,
  previewStyle,
}) => {
  const segments = useMemo(() => {
    const rendered = [];
    for (let i = 0; i < points.length - 1; i++) {
      const style = traceSegmentStyle(points[i], points[i + 1], strokeWidth, color);
      if (style) {
        rendered.push(<TraceInkSegment key={`segment-${i}`} style={style} />);
      }
    }
    if (previewStyle) {
      rendered.push(
        <View key="segment-autoclose-preview" style={previewStyle} />
      );
    }
    return rendered;
  }, [points, strokeWidth, color, previewStyle]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID={testID}>
      {segments}
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    pointerEvents: 'none',
  },
});

export default TraceInk;
