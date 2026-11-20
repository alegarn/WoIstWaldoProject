import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Confirm-time reveal gate: the parent bumps this token when the guess is
  // submitted (confirm modal tap). The scored reveal computed at lift stays
  // HIDDEN until the token changes, so the solution outline never leaks while
  // the guesser is still guessing. 0/undefined = never revealed.
  revealToken?: number;
};

// Guess-only composition wrapper: the draw surface (ShapeCanvas with the
// corridor offset + band slot) plus the graded reveal stacked above it. The
// ONLY judgment in the tree lives at the single lift-time scoring call below;
// the band and the overlay are pure presentational children. The reveal is
// scored at lift but displayed only after the parent's confirm token —
// anti-leak: the verdict + solution outline must not render while guessing.
const GuessShapeSurface: FC<GuessShapeSurfaceProps> = ({
  imageDimensionStyle,
  outline,
  onOutlineChange,
  hiddenOutline,
  imageWidth,
  imageHeight,
  disabled,
  onStrokeUpdate,
  revealToken,
}) => {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [revealed, setRevealed] = useState(false);
  const revealClearScheduledRef = useRef(false);

  // Confirm-time reveal: a changed (non-zero) token unmasks the reveal scored
  // at the last lift. The initial mount run is a no-op for falsy tokens.
  useEffect(() => {
    if (!revealToken) {
      return;
    }
    setRevealed(true);
  }, [revealToken]);

  // Card-swap leak guard: the parent can swap cards in place (win advance via
  // setParams when the key collides), so this surface is NOT guaranteed to
  // remount. A new hidden outline identity means a NEW card — drop the scored
  // and/or unmasked reveal immediately. Declared AFTER the token effect so a
  // same-commit token bump + card swap leaves the reveal cleared.
  const hiddenOutlineRef = useRef(hiddenOutline);
  useEffect(() => {
    if (hiddenOutlineRef.current !== hiddenOutline) {
      hiddenOutlineRef.current = hiddenOutline;
      setReveal(null);
      setRevealed(false);
    }
  }, [hiddenOutline]);

  // Stroke-begin leak guard (L2): the band slot only fires from ≥2 committed
  // points, so the unmasked reveal would otherwise survive finger-down plus
  // the early stroke. Clear synchronously in the gesture handler instead.
  const handleStrokeBegin = useCallback(() => {
    setReveal(null);
    setRevealed(false);
  }, []);

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
  // reveal (scored and/or unmasked) clears there (idempotent no-op when
  // already clear). The band slot runs inside ShapeCanvas's render, so the
  // clear cannot setState there (React forbids updating another component
  // during its render): it is scheduled once per stroke via a microtask,
  // which runs after the render phase and clears before the stroke's lift.
  const handleBandRender = (renderPoints: Point[]): ReactNode => {
    if ((reveal !== null || revealed) && !revealClearScheduledRef.current) {
      revealClearScheduledRef.current = true;
      queueMicrotask(() => {
        revealClearScheduledRef.current = false;
        setReveal(null);
        setRevealed(false);
      });
    }
    return <TraceCorridor trace={renderPoints} bandWidth={bandWidthPx} />;
  };

  // Single lift-time scoring call site (LOCKED 4-param signature): turn the
  // lifted normalized outline into a reveal and forward to the parent so the
  // confirm modal opens. The reveal stays PENDING (unmasked) until the parent
  // bumps the confirm token — no solution leak during active guessing.
  const handleLift = useCallback(
    (next: Point[] | null) => {
      if (!next) {
        setReveal(null);
        setRevealed(false);
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
    },
    [hiddenOutline, imageWidth, imageHeight, onOutlineChange]
  );

  return (
    <View style={StyleSheet.absoluteFill} testID="game.picture.guess-shape-surface">
      <ShapeCanvas
        imageDimensionStyle={imageDimensionStyle}
        outline={outline}
        onOutlineChange={handleLift}
        disabled={disabled}
        onStrokeUpdate={onStrokeUpdate}
        onStrokeBegin={handleStrokeBegin}
        renderBand={handleBandRender}
      />
      <MatchRevealOverlay
        outcome={revealed ? reveal?.outcome ?? null : null}
        scorePercent={revealed ? reveal?.scorePercent ?? 0 : 0}
        hiddenOutline={hiddenOutline ?? null}
        imageDimensionStyle={imageDimensionStyle}
      />
    </View>
  );
};

export default GuessShapeSurface;