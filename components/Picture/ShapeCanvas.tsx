import { useMemo, useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import {
  clampToImage,
  isDrawableOutline,
  normalizeOutline,
  simplifyOutline,
  type Point,
} from '../../utils/shapeGeometry';
import { MIN_STROKE_STEP_PX } from '../../utils/loupeGeometry';
import TraceInk, { traceSegmentStyle } from './TraceInk';

type ImageDimensionStyle = { width: number; height: number };

// Stroke progress reported to the loupe host (plan D3): `anchor` is the
// latest RAW finger point in image px; `renderPoints` is the decimated
// committed polyline the canvas renders. `null` = stroke lifted/cleared.
export type StrokeUpdateInfo = { anchor: Point; renderPoints: Point[] };

type ShapeCanvasProps = {
  imageDimensionStyle: ImageDimensionStyle;
  outline?: Point[] | null;
  onOutlineChange?: (outline: Point[] | null) => void;
  disabled?: boolean;
  onStrokeUpdate?: (info: StrokeUpdateInfo | null) => void;
  // Finger-down seam: fires in the Pan's onBegin, BEFORE any point commit or
  // band render — hosts (e.g. GuessShapeSurface's reveal) clear here instead
  // of waiting for the ≥2-point band slot.
  onStrokeBegin?: () => void;
  renderBand?: (renderPoints: Point[]) => ReactNode;
};

const ShapeCanvas: FC<ShapeCanvasProps> = ({
  imageDimensionStyle,
  outline,
  onOutlineChange,
  disabled = false,
  onStrokeUpdate,
  onStrokeBegin,
  renderBand,
}) => {
  const { t } = useTranslation();
  const [committedPoints, setCommittedPoints] = useState<Point[]>([]);
  const [degenerate, setDegenerate] = useState(false);
  // Three distinct stores, seeded by the pan's onBegin (finger-down) and
  // closed by its onFinalize (lift OR unactivated tap):
  // - `committedPoints` state (this line): the DECIMATED committed polyline —
  //   drives the canvas render, the render band, and mirrors each commit to
  //   the loupe via `onStrokeUpdate`.
  // - `rawPointsRef` (below): judged geometry — EVERY raw finger point lands
  //   here, append-always; decimation is render-only, so the storage pipeline
  //   never sees a thinned stroke.
  // - `committedPointsRef` (below): render commit gate anchor (plan D5) —
  //   the last committed point a new raw point must clear by
  //   MIN_STROKE_STEP_PX to commit.
  const rawPointsRef = useRef<Point[]>([]);
  const committedPointsRef = useRef<Point[]>([]);

  const { width: imageWidth, height: imageHeight } = imageDimensionStyle;

  const storedOutlinePoints = useMemo(() => {
    if (!outline || outline.length === 0) {
      return null;
    }
    return outline.map((point) => ({
      x: point.x * imageWidth,
      y: point.y * imageHeight,
    }));
  }, [outline, imageWidth, imageHeight]);

  // Auto-close preview stays the CALLER's job: built via the shared bar-style
  // builder and composed into TraceInk (which is auto-close-free).
  const autoClosePreviewStyle = useMemo(() => {
    if (committedPoints.length < 3) {
      return null;
    }
    return traceSegmentStyle(
      committedPoints[committedPoints.length - 1],
      committedPoints[0]
    );
  }, [committedPoints]);

  const clampedStrokePoint = (event: { x: number; y: number }) =>
    clampToImage({ x: event.x, y: event.y }, imageWidth, imageHeight);

  const commitStrokePoint = (point: Point) => {
    const renderPoints = [...committedPointsRef.current, point];
    committedPointsRef.current = renderPoints;
    setCommittedPoints(renderPoints);
    onStrokeUpdate?.({ anchor: point, renderPoints });
  };

  // Storage pipeline owner: raw px → simplify → normalize → round to 3
  // decimals before leaving the component, so every consumer (hide storage,
  // guess match, e2e shims) sees the same normalized [0,1] space.
  const finalizeStroke = () => {
    const points = rawPointsRef.current;
    rawPointsRef.current = [];
    committedPointsRef.current = [];
    setCommittedPoints([]);
    if (points.length < 2) {
      onStrokeUpdate?.(null);
      return;
    }
    const simplified = simplifyOutline(points, imageWidth, imageHeight);
    const normalized = normalizeOutline(simplified, imageWidth, imageHeight);
    const drawable = isDrawableOutline(normalized);
    setDegenerate(!drawable);
    onOutlineChange?.(drawable ? normalized : null);
    onStrokeUpdate?.(null);
  };

  // RNGH Pan lifecycle mapping: .onBegin fires at pure finger-down —
  // activation needs ~10dp of travel, so .onStart can never fire at
  // touch-down. .onFinalize fires on END/FAIL/CANCEL, including a tap that
  // never activated, so it always pairs the begin commit and clears the
  // loupe (a tap-without-move may flash the loupe ~1-2 frames — accepted).
  const drawPan = useMemo(() => {
    const pan = Gesture.Pan().enabled(!disabled);
    return pan
      .onBegin((event) => {
        // Touch-down: host seam first (reveal clears etc.), then seed the raw
        // store and commit the first point so the loupe appears immediately,
        // before any movement.
        onStrokeBegin?.();
        setDegenerate(false);
        const point = clampedStrokePoint(event);
        rawPointsRef.current = [point];
        commitStrokePoint(point);
      })
      .onUpdate((event) => {
        // Movement: every raw point lands in the judged ref; only points
        // clearing the MIN_STROKE_STEP_PX gate past the last committed
        // point reach the render commit above.
        const point = clampedStrokePoint(event);
        rawPointsRef.current.push(point);
        const committed = committedPointsRef.current;
        const lastCommitted = committed[committed.length - 1];
        const step = Math.hypot(
          point.x - lastCommitted.x,
          point.y - lastCommitted.y
        );
        if (step >= MIN_STROKE_STEP_PX) {
          commitStrokePoint(point);
        }
      })
      .onFinalize(() => {
        // Always runs (END/FAIL/CANCEL, even never-activated): an
        // unactivated tap holds a single-point stroke → null-only clear.
        finalizeStroke();
      });
  }, [disabled, imageWidth, imageHeight, onOutlineChange, onStrokeUpdate, onStrokeBegin]);

  return (
    <GestureDetector gesture={drawPan}>
      <View style={[StyleSheet.absoluteFill, styles.surface]} testID="game.picture.shape-surface">
        {storedOutlinePoints && (
          <TraceInk
            points={storedOutlinePoints}
            testID="game.picture.shape-outline"
          />
        )}
        {renderBand && committedPoints.length >= 2 && (
          <View style={[StyleSheet.absoluteFill, styles.layer]}>
            {renderBand(committedPoints)}
          </View>
        )}
        {committedPoints.length >= 2 && (
          <TraceInk
            points={committedPoints}
            previewStyle={autoClosePreviewStyle}
            testID="game.picture.shape-trace"
          />
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
