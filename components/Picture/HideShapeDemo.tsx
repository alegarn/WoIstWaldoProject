import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';
import { corridorBandWidthPx } from '../../utils/shapeGeometry';
import { SHAPE_TOLERANCE_RATIO } from '../../utils/shapeMatch';
import {
  looseHideVsSloppyGuessScores,
  looseHideVsExactGuessScore,
  goodHideVsAlmostGuessScore,
  DEMO_IMAGE_SIZE_PX,
  resamplePolyline,
  TIGHT_CONTOUR_POINTS,
  LOOSE_CIRCLE_POINTS,
  SLOPPY_GUESS_A_POINTS,
  SLOPPY_GUESS_B_POINTS,
  ALMOST_BARN_GUESS_POINTS,
} from '../../utils/shapeDemoData';
import TraceCorridor from './TraceCorridor';
import { traceSegmentStyle } from './TraceInk';
import type { TraceSegmentStyle } from './TraceInk';

const CONTOUR_SEGMENT_COUNT = 18;
const CIRCLE_SEGMENT_COUNT = 10;
const GUESS_A_SEGMENT_COUNT = 12;
const GUESS_B_SEGMENT_COUNT = 10;
const ALMOST_SEGMENT_COUNT = 18;
const SEGMENT_STAGGER_MS = 70;
const SEGMENT_DURATION_MS = 16;
const DEMO_STROKE_WIDTH = 4;
const SCENARIO_GROUP_FADE_MS = 250;
const CORRIDOR_FADE_MS = 250;
const PILL_POP_MS = 200;
const PILL_INITIAL_SCALE = 0.6;
const OVERLAY_FADE_MS = 200;
const PHASE_LOOSE_HIDE_MS = 700;
const PHASE_BEAT_MS = 300;
const PHASE_SLOPPY_A_MS = 1560;
const PHASE_SLOPPY_B_MS = 1560;
const PHASE_EXACT_FAILS_MS = 2460;
const PHASE_GOOD_HIDE_MS = 1760;
const PHASE_WINNING_GUESS_MS = 2660;

const PHASE_LOOSE_HIDE = 1;
const PHASE_SLOPPY_A = 3;
const PHASE_SLOPPY_B = 4;
const PHASE_EXACT_FAILS = 5;
const PHASE_GOOD_HIDE = 6;
const PHASE_WINNING_GUESS = 7;

const SEGMENT_STEP_MS = SEGMENT_STAGGER_MS - SEGMENT_DURATION_MS;

// Vertical space kept free below the demo box so the per-phase caption stays
// fully on-screen when the height clamp binds (landscape / short screens).
export const CAPTION_RESERVE_PX = 44;

const FARM_BACKGROUND = require('../../assets/tutorial/farm_pict_hide_320.jpg');

const CIRCLE_POINTS = resamplePolyline(LOOSE_CIRCLE_POINTS, CIRCLE_SEGMENT_COUNT);
const GUESS_A_POINTS = resamplePolyline(SLOPPY_GUESS_A_POINTS, GUESS_A_SEGMENT_COUNT);
const GUESS_B_POINTS = resamplePolyline(SLOPPY_GUESS_B_POINTS, GUESS_B_SEGMENT_COUNT);
const CONTOUR_POINTS = resamplePolyline(TIGHT_CONTOUR_POINTS, CONTOUR_SEGMENT_COUNT);
const ALMOST_BARN_POINTS = resamplePolyline(ALMOST_BARN_GUESS_POINTS, ALMOST_SEGMENT_COUNT);

const SLOPPY_SCORES = looseHideVsSloppyGuessScores();
const SLOPPY_A_PERCENT = `${Math.round(SLOPPY_SCORES.a * 100)}%`;
const SLOPPY_B_PERCENT = `${Math.round(SLOPPY_SCORES.b * 100)}%`;
const EXACT_FAIL_PERCENT = `${Math.round(looseHideVsExactGuessScore() * 100)}%`;
const WIN_PERCENT = `${Math.round(goodHideVsAlmostGuessScore() * 100)}%`;

const PHASE_CAPTION_KEYS: Record<number, string> = {
  [PHASE_LOOSE_HIDE]: 'game.picture.hideCueBadHideCaption',
  [PHASE_SLOPPY_A]: 'game.picture.hideCueGuessCaption',
  [PHASE_SLOPPY_B]: 'game.picture.hideCueGuessCaption',
  [PHASE_EXACT_FAILS]: 'game.picture.hideCueExactFailsCaption',
  [PHASE_GOOD_HIDE]: 'game.picture.hideCueGoodHideCaption',
  [PHASE_WINNING_GUESS]: 'game.picture.hideCueFollowCaption',
};

function segmentChainDurationMs(segmentCount: number): number {
  // Segment i eases at i × SEGMENT_STAGGER_MS and settles after
  // SEGMENT_DURATION_MS, so the chain spans (count−1) × cadence + duration.
  return (segmentCount - 1) * SEGMENT_STAGGER_MS + SEGMENT_DURATION_MS;
}

type VerdictPillSpec = { label: string; percent: string; success: boolean };

function pillSpecFor(phase: number, t: (key: string) => string): VerdictPillSpec | null {
  switch (phase) {
    case PHASE_SLOPPY_A:
      return { label: t('game.picture.hideCueFailLabel'), percent: SLOPPY_A_PERCENT, success: false };
    case PHASE_SLOPPY_B:
      return { label: t('game.picture.hideCueFailLabel'), percent: SLOPPY_B_PERCENT, success: false };
    case PHASE_EXACT_FAILS:
      return { label: t('game.picture.hideCueExactFailsLabel'), percent: EXACT_FAIL_PERCENT, success: false };
    case PHASE_WINNING_GUESS:
      return { label: t('game.picture.traceWin'), percent: WIN_PERCENT, success: true };
    default:
      return null;
  }
}

type AnimatedPolylineProps = {
  points: Point[];
  segmentValues: Animated.Value[];
  fadeValue: Animated.AnimatedNode;
  strokeWidth: number;
  color: string;
};

const AnimatedPolyline: FC<AnimatedPolylineProps> = ({
  points,
  segmentValues,
  fadeValue,
  strokeWidth,
  color,
}) => {
  const segmentStyles = useMemo(() => {
    const pairs: { style: TraceSegmentStyle; value: Animated.Value }[] = [];
    for (let i = 0; i < points.length; i++) {
      const style = traceSegmentStyle(
        points[i],
        points[(i + 1) % points.length],
        strokeWidth,
        color
      );
      if (style) {
        pairs.push({ style, value: segmentValues[i] });
      }
    }
    return pairs;
  }, [points, segmentValues, strokeWidth, color]);

  return (
    <>
      {segmentStyles.map((pair, index) => (
        <Animated.View
          key={`demo-segment-${index}`}
          pointerEvents="none"
          style={[
            pair.style,
            { opacity: Animated.multiply(pair.value, fadeValue) },
          ]}
        />
      ))}
    </>
  );
};

type HideShapeDemoProps = {
  imageDimensionStyle: { width: number; height: number };
  screenHeight: number;
};

const HideShapeDemo: FC<HideShapeDemoProps> = ({
  imageDimensionStyle,
  screenHeight,
}) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(PHASE_LOOSE_HIDE);
  const [corridorVisible, setCorridorVisible] = useState(false);
  const [completed, setCompleted] = useState(false);

  const circleValues = useRef<Animated.Value[]>(
    CIRCLE_POINTS.map(() => new Animated.Value(0))
  ).current;
  const guessAValues = useRef<Animated.Value[]>(
    GUESS_A_POINTS.map(() => new Animated.Value(0))
  ).current;
  const guessBValues = useRef<Animated.Value[]>(
    GUESS_B_POINTS.map(() => new Animated.Value(0))
  ).current;
  const contourValues = useRef<Animated.Value[]>(
    CONTOUR_POINTS.map(() => new Animated.Value(0))
  ).current;
  const almostValues = useRef<Animated.Value[]>(
    ALMOST_BARN_POINTS.map(() => new Animated.Value(0))
  ).current;
  const corridorOpacity = useRef(new Animated.Value(0)).current;
  const groupOpacity = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(PILL_INITIAL_SCALE)).current;
  const overlayFade = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  const groupFade = useMemo(
    () => Animated.multiply(groupOpacity, overlayFade),
    [groupOpacity, overlayFade]
  );

  const demoSide = Math.min(
    imageDimensionStyle.width,
    imageDimensionStyle.height,
    screenHeight - CAPTION_RESERVE_PX
  );

  const pointsPx = useMemo<Point[][]>(
    () =>
      [CIRCLE_POINTS, GUESS_A_POINTS, GUESS_B_POINTS, CONTOUR_POINTS, ALMOST_BARN_POINTS].map(
        (points) =>
          points.map((point) => ({
            x: point.x * demoSide,
            y: point.y * demoSide,
          }))
      ),
    [demoSide]
  );
  const [circlePointsPx, guessAPointsPx, guessBPointsPx, contourPointsPx, almostPointsPx] =
    pointsPx;

  const bandWidthPx = corridorBandWidthPx(
    { imageWidth: DEMO_IMAGE_SIZE_PX, imageHeight: DEMO_IMAGE_SIZE_PX },
    demoSide,
    demoSide,
    SHAPE_TOLERANCE_RATIO
  );

  const pillSpec = pillSpecFor(phase, t);
  const captionKey = PHASE_CAPTION_KEYS[phase] ?? null;

  useEffect(() => {
    if (pillSpec === null) {
      return;
    }
    pillOpacity.setValue(0);
    pillScale.setValue(PILL_INITIAL_SCALE);
    const opacityPop = Animated.timing(pillOpacity, {
      toValue: 1,
      duration: PILL_POP_MS,
      useNativeDriver: false,
    });
    const scalePop = Animated.timing(pillScale, {
      toValue: 1,
      duration: PILL_POP_MS,
      useNativeDriver: false,
    });
    scalePop.start();
    opacityPop.start();
    return () => {
      opacityPop.stop();
      opacityPop.reset();
      scalePop.stop();
      scalePop.reset();
    };
  }, [phase, pillOpacity, pillScale]);

  useEffect(() => {
    isMountedRef.current = true;
    const revealSegment = (value: Animated.Value, index: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: SEGMENT_DURATION_MS,
        delay: index === 0 ? 0 : SEGMENT_STEP_MS,
        useNativeDriver: false,
      });
    // Animated.stagger/parallel are avoided on purpose: they are real
    // composite animations that wrap child start callbacks expecting an
    // EndResult, which breaks under suites that mock Animated.timing. A flat
    // sequence with a per-timing delay reproduces the exact stagger schedule
    // (segment i eases at i × SEGMENT_STAGGER_MS), and the pill's two pops are
    // started concurrently instead of via Animated.parallel.
    const whenFinished = (next: () => void) => (result?: { finished: boolean }) => {
      if (result?.finished && isMountedRef.current) {
        next();
      }
    };
    const groupFadeOut = Animated.timing(groupOpacity, {
      toValue: 0,
      duration: SCENARIO_GROUP_FADE_MS,
      useNativeDriver: false,
    });
    const corridorFade = Animated.timing(corridorOpacity, {
      toValue: 1,
      duration: CORRIDOR_FADE_MS,
      useNativeDriver: false,
    });
    const overlayFadeOut = Animated.timing(overlayFade, {
      toValue: 0,
      duration: OVERLAY_FADE_MS,
      useNativeDriver: false,
    });
    const looseHideChain = Animated.sequence([
      ...circleValues.map(revealSegment),
      Animated.delay(
        PHASE_LOOSE_HIDE_MS + PHASE_BEAT_MS - segmentChainDurationMs(circleValues.length)
      ),
    ]);
    const sloppyAChain = Animated.sequence([
      ...guessAValues.map(revealSegment),
      Animated.delay(PHASE_SLOPPY_A_MS - segmentChainDurationMs(guessAValues.length)),
    ]);
    const sloppyBChain = Animated.sequence([
      ...guessBValues.map(revealSegment),
      Animated.delay(PHASE_SLOPPY_B_MS - segmentChainDurationMs(guessBValues.length)),
    ]);
    const exactFailsChain = Animated.sequence([
      ...contourValues.map(revealSegment),
      Animated.delay(PHASE_EXACT_FAILS_MS - segmentChainDurationMs(contourValues.length)),
    ]);
    const goodHideChain = Animated.sequence([
      Animated.delay(SCENARIO_GROUP_FADE_MS),
      ...contourValues.map(revealSegment),
      corridorFade,
      Animated.delay(
        PHASE_GOOD_HIDE_MS -
          SCENARIO_GROUP_FADE_MS -
          segmentChainDurationMs(contourValues.length) -
          CORRIDOR_FADE_MS
      ),
    ]);
    const winningChain = Animated.sequence([
      ...almostValues.map(revealSegment),
      Animated.delay(PHASE_WINNING_GUESS_MS - segmentChainDurationMs(almostValues.length)),
    ]);
    looseHideChain.start(
      whenFinished(() => {
        setPhase(PHASE_SLOPPY_A);
        sloppyAChain.start(
          whenFinished(() => {
            setPhase(PHASE_SLOPPY_B);
            sloppyBChain.start(
              whenFinished(() => {
                setPhase(PHASE_EXACT_FAILS);
                exactFailsChain.start(
                  whenFinished(() => {
                    setPhase(PHASE_GOOD_HIDE);
                    setCorridorVisible(true);
                    groupFadeOut.start(
                      whenFinished(() => {
                        for (const value of contourValues) {
                          value.setValue(0);
                        }
                        goodHideChain.start(
                          whenFinished(() => {
                            setPhase(PHASE_WINNING_GUESS);
                            setCorridorVisible(false);
                            winningChain.start(
                              whenFinished(() => {
                                overlayFadeOut.start(
                                  whenFinished(() => {
                                    setCompleted(true);
                                  })
                                );
                              })
                            );
                          })
                        );
                      })
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
    return () => {
      isMountedRef.current = false;
      const chains = [
        looseHideChain,
        sloppyAChain,
        sloppyBChain,
        exactFailsChain,
        groupFadeOut,
        goodHideChain,
        corridorFade,
        winningChain,
        overlayFadeOut,
      ];
      for (const chain of chains) {
        chain.stop();
        chain.reset();
      }
    };
  }, [
    circleValues,
    guessAValues,
    guessBValues,
    contourValues,
    almostValues,
    corridorOpacity,
    groupOpacity,
    overlayFade,
  ]);

  if (completed) {
    return null;
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      testID="game.picture.hide-cue"
      pointerEvents="none"
    >
      <View
        style={[styles.demoBox, { width: demoSide, height: demoSide }]}
        accessibilityLabel={t('game.picture.hideCueLabel')}
        pointerEvents="none"
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { opacity: overlayFade }]}
        >
          <ImageBackground
            source={FARM_BACKGROUND}
            style={styles.demoImage}
            imageStyle={styles.demoImage}
            pointerEvents="none"
          />
        </Animated.View>
        {corridorVisible && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.layer,
              { opacity: Animated.multiply(corridorOpacity, overlayFade) },
            ]}
          >
            <TraceCorridor trace={contourPointsPx} bandWidth={bandWidthPx} />
          </Animated.View>
        )}
        <AnimatedPolyline
          points={circlePointsPx}
          segmentValues={circleValues}
          fadeValue={groupFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={GlobalStyle.color.primaryColor}
        />
        <AnimatedPolyline
          points={guessAPointsPx}
          segmentValues={guessAValues}
          fadeValue={groupFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={GlobalStyle.color.error500}
        />
        <AnimatedPolyline
          points={guessBPointsPx}
          segmentValues={guessBValues}
          fadeValue={groupFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={GlobalStyle.color.info}
        />
        <AnimatedPolyline
          points={contourPointsPx}
          segmentValues={contourValues}
          fadeValue={overlayFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={
            phase >= PHASE_GOOD_HIDE
              ? GlobalStyle.color.primaryColor
              : GlobalStyle.color.primaryColor500
          }
        />
        <AnimatedPolyline
          points={almostPointsPx}
          segmentValues={almostValues}
          fadeValue={overlayFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={GlobalStyle.color.success}
        />
        {pillSpec && (
          <Animated.View
            testID="game.picture.hide-cue-verdict"
            pointerEvents="none"
            style={[
              styles.verdictRow,
              {
                opacity: Animated.multiply(pillOpacity, overlayFade),
                transform: [{ scale: pillScale }],
              },
            ]}
          >
            <Text
              style={[styles.verdict, pillSpec.success && styles.verdictSuccess]}
            >
              {pillSpec.label}
            </Text>
            <Text
              style={[styles.verdict, pillSpec.success && styles.verdictSuccess]}
            >
              {pillSpec.percent}
            </Text>
          </Animated.View>
        )}
      </View>
      {captionKey && (
        <Text
          testID="game.picture.hide-cue-caption"
          pointerEvents="none"
          style={styles.caption}
        >
          {t(captionKey)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  demoBox: {
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  demoImage: {
    width: '100%',
    height: '100%',
  },
  caption: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: GlobalStyle.color.scrim,
    color: GlobalStyle.color.onSurface,
    textAlign: 'center',
    maxWidth: '90%',
    pointerEvents: 'none',
  },
  verdictRow: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: GlobalStyle.color.scrim,
    pointerEvents: 'none',
  },
  verdict: {
    color: GlobalStyle.color.onSurface,
    textAlign: 'center',
  },
  verdictSuccess: {
    color: GlobalStyle.color.success,
  },
});

export default HideShapeDemo;
