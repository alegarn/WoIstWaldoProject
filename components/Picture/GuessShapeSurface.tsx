import { useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import ShapeCanvas, { type StrokeUpdateInfo } from './ShapeCanvas';
import TraceCorridor from './TraceCorridor';
import MatchRevealOverlay from './MatchRevealOverlay';
import { MAX_LENGTH_RATIO, SHAPE_TOLERANCE_RATIO, isWinningTrace, outlineMatchScore } from '../../utils/shapeMatch';
import { corridorBandWidthPx, outlineLengthInImageSpace } from '../../utils/shapeGeometry';
import type { Point } from '../../utils/shapeGeometry';

type RevealOutcome = 'win' | 'loseScore' | 'loseLengthCap';

type Reveal = { outcome: RevealOutcome; scorePercent: number };

type GuessShapeSurfaceProps = {
  imageDimensionStyle: { width: number; height: number };
  outline?: Point[] | null;
  onOutlineChange?: (outline: Point[] | null) => void;
  hiddenOutline?: Point[] | null;
  imageWidth?: number;
  imageHeight?: number;
  disabled?: boolean;
  onStrokeUpdate?: (info: StrokeUpdateInfo | null) => void;
};

// Guess-only composition wrapper: the draw surface (ShapeCanvas with the
// corridor offset + band slot) plus the graded reveal stacked above it. The
// ONLY judgment in the tree lives at the single lift-time scoring call below;
// the band and the overlay are pure presentational children.
const GuessShapeSurface: FC<GuessShapeSurfaceProps> = ({
  imageDimensionStyle,
  outline,
  onOutlineChange,
  hiddenOutline,
  imageWidth,
  imageHeight,
  disabled,
  onStrokeUpdate,
}) => {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const revealClearScheduledRef = useRef(false);

  const styleWidth = imageDimensionStyle.width;
  const styleHeight = imageDimensionStyle.height;

  // Corridor diameter in screen px, via the shared helper (single source with
  // the loupe's units): image-space tolerance circle scaled onto the rendered
  // surface; missing image dims fall back to the rendered style dimensions.
  const bandWidthPx = corridorBandWidthPx(
    { imageWidth, imageHeight },
    styleWidth,
    styleHeight,
    SHAPE_TOLERANCE_RATIO
  );

  // Stroke-start seam: the band slot only fires while a live stroke has ≥2
  // points, so its first invocation of each stroke IS stroke start — the
  // reveal clears there (idempotent no-op when already null). The band slot
  // runs inside ShapeCanvas's render, so the clear cannot setState there
  // (React forbids updating another component during its render): it is
  // scheduled once per stroke via a microtask, which runs after the render
  // phase and clears the reveal before the stroke's lift.
  const handleBandRender = (renderPoints: Point[]): ReactNode => {
    if (reveal !== null && !revealClearScheduledRef.current) {
      revealClearScheduledRef.current = true;
      queueMicrotask(() => {
        revealClearScheduledRef.current = false;
        setReveal(null);
      });
    }
    return <TraceCorridor trace={renderPoints} bandWidth={bandWidthPx} />;
  };

  // Single lift-time scoring call site (LOCKED 4-param signature): turn the
  // lifted normalized outline into a reveal, then forward to the parent LAST
  // so the confirm modal opens after the reveal state commits.
  const handleLift = (next: Point[] | null) => {
    if (!next) {
      setReveal(null);
      onOutlineChange?.(null);
      return;
    }
    const hidden = hiddenOutline ?? [];
    const params = {
      hiddenShape: hidden,
      guessShape: next,
      imageWidth: imageWidth ?? 0,
      imageHeight: imageHeight ?? 0,
    };
    const score = outlineMatchScore(params);
    const win = isWinningTrace(params);
    const capFailed =
      outlineLengthInImageSpace(next, imageWidth ?? 0, imageHeight ?? 0) >
      MAX_LENGTH_RATIO * outlineLengthInImageSpace(hidden, imageWidth ?? 0, imageHeight ?? 0);
    setReveal({
      outcome: win ? 'win' : capFailed ? 'loseLengthCap' : 'loseScore',
      scorePercent: Math.round(score * 100),
    });
    onOutlineChange?.(next);
  };

  return (
    <View style={StyleSheet.absoluteFill} testID="game.picture.guess-shape-surface">
      <ShapeCanvas
        imageDimensionStyle={imageDimensionStyle}
        outline={outline}
        onOutlineChange={handleLift}
        disabled={disabled}
        onStrokeUpdate={onStrokeUpdate}
        renderBand={handleBandRender}
      />
      <MatchRevealOverlay
        outcome={reveal?.outcome ?? null}
        scorePercent={reveal?.scorePercent ?? 0}
        hiddenOutline={hiddenOutline ?? null}
        imageDimensionStyle={imageDimensionStyle}
      />
    </View>
  );
};

export default GuessShapeSurface;