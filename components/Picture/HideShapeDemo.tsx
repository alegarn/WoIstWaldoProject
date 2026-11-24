import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import type { Point } from '../../utils/shapeGeometry';
import { corridorBandWidthPx } from '../../utils/shapeGeometry';
import { SHAPE_TOLERANCE_RATIO } from '../../utils/shapeMatch';
import {
  demoFailScore,
  DEMO_IMAGE_SIZE_PX,
  resamplePolyline,
  TIGHT_CONTOUR_POINTS,
  LOOSE_CIRCLE_POINTS,
  FAILING_LINE_POINTS,
} from '../../utils/shapeDemoData';
import TraceCorridor from './TraceCorridor';
import { traceSegmentStyle } from './TraceInk';
import type { TraceSegmentStyle } from './TraceInk';

const CONTOUR_SEGMENT_COUNT = 18;
const CIRCLE_SEGMENT_COUNT = 10;
const LINE_SEGMENT_COUNT = 18;
const SEGMENT_STAGGER_MS = 70;
const SEGMENT_DURATION_MS = 16;
const DEMO_STROKE_WIDTH = 4;
const CORRIDOR_FADE_MS = 250;
const CORRIDOR_HOLD_MS = 400;
const PHASE2_BEAT_MS = 400;
const PILL_POP_MS = 200;
const PILL_INITIAL_SCALE = 0.6;
const PILL_HOLD_MS = 1200;
const OVERLAY_FADE_MS = 200;

const FARM_BACKGROUND = require('../../assets/tutorial/farm_pict_hide_320.jpg');

const CONTOUR_POINTS = resamplePolyline(TIGHT_CONTOUR_POINTS, CONTOUR_SEGMENT_COUNT);
const CIRCLE_POINTS = resamplePolyline(LOOSE_CIRCLE_POINTS, CIRCLE_SEGMENT_COUNT);
const LINE_POINTS = resamplePolyline(FAILING_LINE_POINTS, LINE_SEGMENT_COUNT);
const FAIL_PERCENT = `${Math.round(demoFailScore() * 100)}%`;

type AnimatedPolylineProps = {
  points: Point[];
  segmentValues: Animated.Value[];
  fadeValue: Animated.Value;
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
};

const HideShapeDemo: FC<HideShapeDemoProps> = ({ imageDimensionStyle }) => {
  const { t } = useTranslation();
  const [corridorVisible, setCorridorVisible] = useState(false);
  const [circleVisible, setCircleVisible] = useState(false);
  const [lineVisible, setLineVisible] = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const [completed, setCompleted] = useState(false);

  const contourValues = useRef<Animated.Value[]>(
    CONTOUR_POINTS.map(() => new Animated.Value(0))
  ).current;
  const circleValues = useRef<Animated.Value[]>(
    CIRCLE_POINTS.map(() => new Animated.Value(0))
  ).current;
  const lineValues = useRef<Animated.Value[]>(
    LINE_POINTS.map(() => new Animated.Value(0))
  ).current;
  const corridorOpacity = useRef(new Animated.Value(0)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(PILL_INITIAL_SCALE)).current;
  const overlayFade = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  const demoSide = Math.min(
    imageDimensionStyle.width,
    imageDimensionStyle.height
  );

  const contourPointsPx = useMemo<Point[]>(
    () =>
      CONTOUR_POINTS.map((point) => ({
        x: point.x * demoSide,
        y: point.y * demoSide,
      })),
    [demoSide]
  );
  const circlePointsPx = useMemo<Point[]>(
    () =>
      CIRCLE_POINTS.map((point) => ({
        x: point.x * demoSide,
        y: point.y * demoSide,
      })),
    [demoSide]
  );
  const linePointsPx = useMemo<Point[]>(
    () =>
      LINE_POINTS.map((point) => ({
        x: point.x * demoSide,
        y: point.y * demoSide,
      })),
    [demoSide]
  );

  const bandWidthPx = corridorBandWidthPx(
    { imageWidth: DEMO_IMAGE_SIZE_PX, imageHeight: DEMO_IMAGE_SIZE_PX },
    demoSide,
    demoSide,
    SHAPE_TOLERANCE_RATIO
  );

  useEffect(() => {
    isMountedRef.current = true;
    const revealSegment = (value: Animated.Value, index: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: SEGMENT_DURATION_MS,
        delay: index === 0 ? 0 : SEGMENT_STAGGER_MS - SEGMENT_DURATION_MS,
        useNativeDriver: false,
      });
    // Animated.stagger/parallel are avoided on purpose: they are real
    // composite animations that wrap child start callbacks expecting an
    // EndResult, which breaks under suites that mock Animated.timing. A flat
    // sequence with a per-timing delay reproduces the exact stagger schedule
    // (segment i eases at i × SEGMENT_STAGGER_MS), and the pill's two pops are
    // started concurrently instead of via Animated.parallel.
    const contourTrace = Animated.sequence(contourValues.map(revealSegment));
    const corridorChain = Animated.sequence([
      Animated.timing(corridorOpacity, {
        toValue: 1,
        duration: CORRIDOR_FADE_MS,
        useNativeDriver: false,
      }),
      Animated.delay(CORRIDOR_HOLD_MS),
    ]);
    const circleTrace = Animated.sequence(circleValues.map(revealSegment));
    const lineChain = Animated.sequence([
      Animated.delay(PHASE2_BEAT_MS),
      ...lineValues.map(revealSegment),
    ]);
    const pillOpacityPop = Animated.timing(pillOpacity, {
      toValue: 1,
      duration: PILL_POP_MS,
      useNativeDriver: false,
    });
    const pillScalePop = Animated.timing(pillScale, {
      toValue: 1,
      duration: PILL_POP_MS,
      useNativeDriver: false,
    });
    const fadeChain = Animated.sequence([
      Animated.delay(PILL_HOLD_MS),
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: OVERLAY_FADE_MS,
        useNativeDriver: false,
      }),
    ]);
    contourTrace.start(({ finished }) => {
      if (!finished || !isMountedRef.current) {
        return;
      }
      setCorridorVisible(true);
      corridorChain.start(({ finished: corridorFinished }) => {
        if (!corridorFinished || !isMountedRef.current) {
          return;
        }
        setCircleVisible(true);
        circleTrace.start(({ finished: circleFinished }) => {
          if (!circleFinished || !isMountedRef.current) {
            return;
          }
          setLineVisible(true);
          lineChain.start(({ finished: lineFinished }) => {
            if (!lineFinished || !isMountedRef.current) {
              return;
            }
            setPillVisible(true);
            pillScalePop.start();
            pillOpacityPop.start((pillResult) => {
              if (!pillResult?.finished || !isMountedRef.current) {
                return;
              }
              fadeChain.start((fadeResult) => {
                if (fadeResult?.finished && isMountedRef.current) {
                  setCompleted(true);
                }
              });
            });
          });
        });
      });
    });
    return () => {
      isMountedRef.current = false;
      const chains = [
        contourTrace,
        corridorChain,
        circleTrace,
        lineChain,
        pillOpacityPop,
        pillScalePop,
        fadeChain,
      ];
      for (const chain of chains) {
        chain.stop();
        chain.reset();
      }
    };
  }, [
    contourValues,
    circleValues,
    lineValues,
    corridorOpacity,
    pillOpacity,
    pillScale,
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
          points={contourPointsPx}
          segmentValues={contourValues}
          fadeValue={overlayFade}
          strokeWidth={DEMO_STROKE_WIDTH}
          color={GlobalStyle.color.primaryColor}
        />
        {circleVisible && (
          <AnimatedPolyline
            points={circlePointsPx}
            segmentValues={circleValues}
            fadeValue={overlayFade}
            strokeWidth={DEMO_STROKE_WIDTH}
            color={GlobalStyle.color.primaryColor}
          />
        )}
        {lineVisible && (
          <AnimatedPolyline
            points={linePointsPx}
            segmentValues={lineValues}
            fadeValue={overlayFade}
            strokeWidth={DEMO_STROKE_WIDTH}
            color={GlobalStyle.color.primaryColor500}
          />
        )}
        {pillVisible && (
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
            <Text style={styles.verdict}>
              {t('game.picture.hideCueFailLabel')}
            </Text>
            <Text style={styles.percent}>{FAIL_PERCENT}</Text>
          </Animated.View>
        )}
      </View>
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
  percent: {
    color: GlobalStyle.color.onSurface,
    textAlign: 'center',
  },
});

export default HideShapeDemo;
