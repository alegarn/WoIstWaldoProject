import { useMemo } from 'react';
import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';

type TraceCorridorProps = {
  trace: Point[];
  bandWidth: number;
};

const BAND_OPACITY = 0.25;

// Same polyline→rotated-View math as ShapeCanvas's segmentStyle, widened into
// the tolerance band: each segment is a horizontal bar centered on its
// midpoint, rotated around the view center to span start→end exactly. Local
// duplication is accepted — ShapeCanvas's helper is module-private.
function bandSegmentStyle(start: Point, end: Point, bandWidth: number) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return null;
  }
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return {
    position: 'absolute' as const,
    left: (start.x + end.x) / 2 - length / 2,
    top: (start.y + end.y) / 2 - bandWidth / 2,
    width: length,
    height: bandWidth,
    borderRadius: bandWidth / 2,
    backgroundColor: GlobalStyle.color.primaryColor,
    opacity: BAND_OPACITY,
    transform: [{ rotate: `${angle}deg` }],
  };
}

// Guess-side tolerance corridor: pure presentational band over the live
// (post-offset) trace. Zero judgment, zero i18n, zero gesture — the scoring
// and stored outline live elsewhere.
const TraceCorridor: FC<TraceCorridorProps> = ({ trace, bandWidth }) => {
  const segments = useMemo(() => {
    if (trace.length < 2) {
      return [];
    }
    const rendered = [];
    for (let i = 0; i < trace.length - 1; i++) {
      const style = bandSegmentStyle(trace[i], trace[i + 1], bandWidth);
      if (style) {
        rendered.push(<View key={`segment-${i}`} style={style} />);
      }
    }
    if (trace.length >= 3) {
      const preview = bandSegmentStyle(
        trace[trace.length - 1],
        trace[0],
        bandWidth
      );
      if (preview) {
        rendered.push(<View key="segment-autoclose-preview" style={preview} />);
      }
    }
    return rendered;
  }, [trace, bandWidth]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.layer]}
      testID="game.picture.trace-band"
    >
      {segments}
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    pointerEvents: 'none',
  },
});

export default TraceCorridor;
