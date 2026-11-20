import { useMemo } from 'react';
import type { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';

type RevealOutcome = 'win' | 'loseScore' | 'loseLengthCap';

type MatchRevealOverlayProps = {
  outcome: RevealOutcome | null;
  scorePercent: number;
  hiddenOutline: Point[] | null;
  imageDimensionStyle: { width: number; height: number };
};

// Resolution a: copy-only verdict strings (no interpolation token) — the
// match % is this overlay's own numeric Text. Single coupling point between
// outcome and copy.
const VERDICT_KEYS: Record<Exclude<RevealOutcome, null>, string> = {
  win: 'game.picture.traceWin',
  loseScore: 'game.picture.traceLoseScore',
  loseLengthCap: 'game.picture.traceLoseLengthCap',
};

const HIDDEN_STROKE_WIDTH = 2;

// Same polyline→rotated-View math as ShapeCanvas's segmentStyle, fed the
// hidden outline normalized→px via the image dimension style, in the distinct
// reveal color.
function hiddenSegmentStyle(
  start: Point,
  end: Point,
  imageWidth: number,
  imageHeight: number
) {
  const startPx = { x: start.x * imageWidth, y: start.y * imageHeight };
  const endPx = { x: end.x * imageWidth, y: end.y * imageHeight };
  const length = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y);
  if (length === 0) {
    return null;
  }
  const angle = (Math.atan2(endPx.y - startPx.y, endPx.x - startPx.x) * 180) / Math.PI;
  return {
    position: 'absolute' as const,
    left: (startPx.x + endPx.x) / 2 - length / 2,
    top: (startPx.y + endPx.y) / 2 - HIDDEN_STROKE_WIDTH / 2,
    width: length,
    height: HIDDEN_STROKE_WIDTH,
    borderRadius: HIDDEN_STROKE_WIDTH / 2,
    backgroundColor: GlobalStyle.color.primaryColor500,
    transform: [{ rotate: `${angle}deg` }],
  };
}

// Guess-side graded reveal: the hidden outline re-drawn thin and distinct,
// plus the verdict copy and the numeric match percent. PURE presentational —
// verdicts and percent arrive as props; zero scoring imports, zero state.
const MatchRevealOverlay: FC<MatchRevealOverlayProps> = ({
  outcome,
  scorePercent,
  hiddenOutline,
  imageDimensionStyle,
}) => {
  const { t } = useTranslation();

  const segments = useMemo(() => {
    if (!hiddenOutline) {
      return [];
    }
    const rendered = [];
    for (let i = 0; i < hiddenOutline.length - 1; i++) {
      const style = hiddenSegmentStyle(
        hiddenOutline[i],
        hiddenOutline[i + 1],
        imageDimensionStyle.width,
        imageDimensionStyle.height
      );
      if (style) {
        rendered.push(<View key={`segment-${i}`} style={style} />);
      }
    }
    return rendered;
  }, [hiddenOutline, imageDimensionStyle]);

  if (outcome === null || hiddenOutline == null) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID="game.picture.trace-reveal">
      <View
        style={[StyleSheet.absoluteFill, styles.layer]}
        testID="game.picture.trace-reveal-outline"
      >
        {segments}
      </View>
      <View style={styles.verdictRow}>
        <Text style={styles.verdict} testID="game.picture.trace-reveal-verdict">
          {t(VERDICT_KEYS[outcome])}
        </Text>
        <Text style={styles.percent} testID="game.picture.trace-reveal-percent">
          {`${scorePercent}%`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    pointerEvents: 'none',
  },
  verdictRow: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    paddingHorizontal: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: GlobalStyle.color.scrim,
  },
  verdict: {
    color: GlobalStyle.color.onSurface,
    textAlign: 'center',
  },
  percent: {
    color: GlobalStyle.color.onSurface,
    textAlign: 'center',
  },
});

export default MatchRevealOverlay;
