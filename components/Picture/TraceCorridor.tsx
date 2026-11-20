import { memo, useMemo } from 'react';
import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { areSegmentStylesEqual, type TraceSegmentStyle } from './TraceInk';
import type { Point } from '../../utils/shapeGeometry';

type TraceCorridorProps = {
  trace: Point[];
  bandWidth: number;
};

const BAND_OPACITY = 0.25;

export type BandSegmentStyle = TraceSegmentStyle & { opacity: number };

type BandSegmentProps = { style: BandSegmentStyle };

// Same polyline→rotated-View math as TraceInk's exported traceSegmentStyle,
// widened into the tolerance band: each segment is a horizontal bar centered
// on its midpoint, rotated around the view center to span start→end exactly,
// with the band-only translucency added on top. Local duplication is
// accepted — the band carries `opacity`, which the shared thin-line style
// does not.
function bandSegmentStyle(
  start: Point,
  end: Point,
  bandWidth: number
): BandSegmentStyle | null {
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

/**
 * Value-equality gate for memoized band bars: the parent rebuilds style
 * objects per commit, so identity comparison would re-render every bar.
 * Equal-VALUE styles (geometry + translucency) skip the bar render entirely.
 */
export function areBandSegmentPropsEqual(
  prev: BandSegmentProps,
  next: BandSegmentProps
): boolean {
  return (
    areSegmentStylesEqual(prev?.style, next?.style) &&
    prev?.style?.opacity === next?.style?.opacity
  );
}

export const TraceCorridorSegment = memo<BandSegmentProps>(
  ({ style }) => <View style={style} />,
  areBandSegmentPropsEqual
);

// Guess-side tolerance corridor: pure presentational band over the live
// (post-offset) trace. Zero judgment, zero i18n, zero gesture — the scoring
// and stored outline live elsewhere. Band bars are React.memo'd
// (value-equal styles skip re-render) so appending point N renders only
// segment N−1, matching TraceInk.
const TraceCorridor: FC<TraceCorridorProps> = ({ trace, bandWidth }) => {
  const segments = useMemo(() => {
    if (trace.length < 2) {
      return [];
    }
    const rendered = [];
    for (let i = 0; i < trace.length - 1; i++) {
      const style = bandSegmentStyle(trace[i], trace[i + 1], bandWidth);
      if (style) {
        rendered.push(
          <TraceCorridorSegment key={`segment-${i}`} style={style} />
        );
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
