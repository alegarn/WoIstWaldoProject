import { useState, useLayoutEffect, useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { handleImageOrientation } from '../../utils/orientation';
import { buildCenteredTarget } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';
import { setImageDimensions } from '../../utils/imageDimensions';
import {
  buildE2EPictureSelection,
  getE2EHideLocation,
  getE2EIncorrectHideLocation,
  getE2EShapeOutline,
  isE2EMode,
} from '../../utils/e2eMode';
import { SHAPE_SPEED_BONUS_THRESHOLD_MS, SPEED_WINDOW_MS } from '../../utils/speedMultiplier';
import { ANY_FILTER, normalizeMode } from '../../utils/sessionFilter';
import { GlobalStyle } from '../../constants/theme';
import { useReadingGrace } from '../../hooks/useReadingGrace';
import { useSpeedTimer } from '../../hooks/useSpeedTimer';
import { useTargetDrag } from '../../hooks/useTargetDrag';
import type { Point } from '../../utils/shapeGeometry';
import ModeCue from './ModeCue';

type ImageMode = 'point' | 'shape';
type ShapeOutline = Point[];
type SelectionLocation = { x: string; y: string };
type TargetStyle = {
  position: 'absolute';
  width: number;
  height: number;
  left: number;
  top: number;
  borderRadius?: number;
  alignItems?: 'center';
  justifyContent?: 'center';
};
type SelectionTarget = {
  targetSize: number;
  targetStyle: TargetStyle;
  dragSize?: number;
  dragStyle?: TargetStyle;
};
type ImageDimensionStyle = { width: number; height: number };
type HiddenLocation = { x: number; y: number };
type Selection = { location: SelectionLocation; target: SelectionTarget };

export type ToAdScreenArgs = {
  location: SelectionLocation | null;
  hiddenLocation?: HiddenLocation;
  screenWidth: number;
  screenHeight: number;
  target: SelectionTarget | null;
  elapsedMs: number;
  mode?: ImageMode;
  shape?: ShapeOutline | null;
};

export type GuessPictureProps = {
  navigation?: unknown;
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageIsPortrait?: boolean;
  imageHeight?: number;
  imageWidth?: number;
  hiddenLocation?: HiddenLocation;
  // Shape mode card contract (plan H): mode 'shape' swaps the point drag for
  // the F drawing surface; `shape` is the hidden normalized outline.
  mode?: ImageMode;
  shape?: ShapeOutline | null;
  // Session MODE filter (raw route value, unnormalized): gates the Mode Cue —
  // shown only for shape cards in a feed that normalizes to 'any'.
  filterMode?: string;
  screenDimensions: { width: number; height: number };
  toAdScreen?: (args: ToAdScreenArgs) => void | Promise<void>;
  skipInstructions?: boolean;
  pulseTarget?: boolean;
  onInteract?: () => void;
  // PB2: input gating — when true (advance state machine mid-cycle), disable
  // tap/drag confirmation so toAdScreen cannot double-fire during a resolve.
  // Forwards to useTargetDrag via `enabled: !disabled && !isE2EMode()`.
  disabled?: boolean;
  // Edge-swipe (left 36px) opened the exit menu in a separate higher-zIndex
  // subtree that intercepted touches in that zone, starving the target's drag.
  // Detection now lives in the picture subtree (ShowPicture's nested RNGH
  // surface detector); this callback fires when the surface recognizes the
  // rightward swipe so the parent (GuessScreen) can open the exit menu.
  onEdgeSwipe?: () => void;
};

const GuessPicture: FC<GuessPictureProps> = ({
  imageFile,
  description,
  imageIsPortrait,
  imageHeight,
  imageWidth,
  hiddenLocation,
  mode,
  shape,
  filterMode,
  screenDimensions,
  toAdScreen,
  skipInstructions,
  pulseTarget = false,
  onInteract,
  disabled = false,
  onEdgeSwipe,
}) => {
  const { t } = useTranslation();
  const isShapeMode = mode === 'shape';
  // Mode Cue (shape-mode-cue plan): shape card + feed filter normalizing to
  // 'any' + never in E2E mode (Maestro stays deterministic). GuessPicture owns
  // the gating; ShowPicture just renders the generic surface overlay node.
  const showModeCue = isShapeMode && normalizeMode(filterMode) === ANY_FILTER && !isE2EMode();

  const [dismissed, setDismissed] = useState(false);
  const showFilter = !skipInstructions && !dismissed;
  // Shape-mode state: the drawn outline (F surface output, normalized [0,1])
  // and the controlled enigma channel for ShowPicture (F2) — the surface
  // swipe classifier that used to re-open it is suppressed whole-mode.
  const [guessOutline, setGuessOutline] = useState<ShapeOutline | null>(null);
  const [shapeEnigmaOpen, setShapeEnigmaOpen] = useState(skipInstructions === true);
  // Anti-leak reveal gate: bumped ONLY on confirm so the surface's graded
  // reveal (solution outline + verdict) unmasks after submission, never at
  // stroke lift while the guesser is still guessing.
  const [revealToken, setRevealToken] = useState(0);
  // Live clamped target centre (image-px) while the drag is active; null on
  // finalize. Threaded into ShowPicture to anchor the loupe (D3/D4).
  const [dragPosition, setDragPosition] = useState<Point | null>(null);

  // Reading grace delays the chrono on 2nd+ cards (skipInstructions) while the
  // enigma opens by default. Ends at the earliest of graceMs or description close.
  const { graceDone, markClosed } = useReadingGrace({ enabled: skipInstructions === true && !isE2EMode() });

  const uri = imageFile;
  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  const isPortrait = imageIsPortrait;
  const { maxImageHeight, maxImageWidth } = setImageDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });
  const imageDimensionStyle: ImageDimensionStyle = { width: maxImageWidth, height: maxImageHeight };

  const initialSelection = useMemo<Selection | null>(
    () => (isE2EMode() ? null : buildCenteredTarget({ screenWidth, screenHeight, imageDimensionStyle }) as Selection),
    [screenWidth, screenHeight, maxImageWidth, maxImageHeight]
  );

  const [showModal, setShowModal] = useState(false);

  const { elapsedMs } = useSpeedTimer({
    active: !showFilter && !showModal && graceDone && !isE2EMode(),
  });

  const {
    touchLocation,
    target,
    gesture: targetGesture,
    setSelection,
  } = useTargetDrag({
    // PB2: gate input while the advance state machine is mid-cycle so a
    // double-tap during a Tier 2/3/4 resolve cannot double-fire toAdScreen.
    // isE2EMode short-circuits panResponder entirely (e2e drives target via
    // direct surface taps); disabled covers the runtime gating path.
    // Shape mode replaces the point drag with the F drawing surface.
    enabled: !isShapeMode && !isE2EMode() && !disabled,
    screenWidth,
    screenHeight,
    imageDimensionStyle,
    initialSelection,
    onInteract,
    onTap: () => setShowModal(true),
    onDragPosition: setDragPosition,
  });

  useLayoutEffect(() => {
    handleImageOrientation({ imageIsPortrait });
  }, [imageIsPortrait]);

  const handleFilterClick = () => {
    setDismissed(true);
  };

  const selectPictureLocation = ({ relativeLocation }: { relativeLocation: HiddenLocation }) => {
    const selection = buildE2EPictureSelection({
      screenWidth,
      screenHeight,
      imageDimensionStyle,
      relativeLocation,
    }) as Selection;

    const { location, target: selectionTarget } = selection;
    if (location && selectionTarget) {
      setSelection(selection);
    }
  };

  // F surface output: outline arrives normalized [0,1] (ShapeCanvas owns the
  // px→[0,1] pipeline). A drawable outline opens the confirm modal; a null
  // (redraw) just clears it — ShowPicture's redraw path closes the modal.
  const applyGuessOutline = (outline: ShapeOutline | null) => {
    setGuessOutline(outline);
    if (outline) {
      onInteract?.();
      setShowModal(true);
    }
  };

  // E2E-only shape seeding (I shim): a tap/long press pre-fills the hit/miss
  // variant outline and opens the confirm modal, mirroring the draw flow.
  const seedE2EShapeOutline = (variant: 'hit' | 'miss') => {
    applyGuessOutline(getE2EShapeOutline(variant));
  };

  const handlePress = () => {
    if (isShapeMode) {
      // Real usage: the outline is drawn on the F surface; a surface tap does
      // not seed anything. E2E drives deterministic hit/miss outlines instead.
      if (!isE2EMode()) return;
      seedE2EShapeOutline('hit');
      return;
    }
    if (!isE2EMode()) return; // real usage: target is drag-only; image tap does not move it
    selectPictureLocation({
      relativeLocation: hiddenLocation ?? getE2EHideLocation(),
    });
  };

  const handleLongPress = () => {
    if (isShapeMode) {
      if (!isE2EMode()) {
        return;
      }
      seedE2EShapeOutline('miss');
      return;
    }

    if (!isE2EMode()) {
      return;
    }

    selectPictureLocation({
      relativeLocation: getE2EIncorrectHideLocation(),
    });
  };

  const handleShapeEnigmaPress = () => {
    onInteract?.();
    setShapeEnigmaOpen(true);
  };

  const handleShapeExitPress = () => {
    onInteract?.();
    onEdgeSwipe?.();
  };

  const handleIconPress = () => {
    onInteract?.();
    setShowModal(true);
  };

  const handleConfirm = () => {
    onInteract?.();
    setShowModal(false);
    setRevealToken((token) => token + 1);
    toAdScreen?.({
      location: isShapeMode ? null : touchLocation,
      hiddenLocation,
      screenWidth,
      screenHeight,
      target: isShapeMode ? null : target,
      elapsedMs,
      ...(isShapeMode ? { mode: 'shape' as const, shape: guessOutline } : {}),
    });
  };

  const onCancel = () => {
    setShowModal(false);
  };


  const renderPicture = () => {
    return (
      <ShowPicture
        uri={uri}
        guess={true}
        description={description}
        touchLocation={isShapeMode ? null : touchLocation}
        handlePress={handlePress}
        handleLongPress={handleLongPress}
        target={isShapeMode ? null : target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        targetGesture={isShapeMode ? undefined : targetGesture}
        defaultOpen={skipInstructions === true}
        pulseTarget={pulseTarget}
        speedRingActive={!showFilter && !showModal && graceDone && !isE2EMode()}
        speedDurationMs={isShapeMode ? SHAPE_SPEED_BONUS_THRESHOLD_MS : SPEED_WINDOW_MS}
        onDescriptionClosed={() => {
          markClosed();
          setShapeEnigmaOpen(false);
        }}
        onEdgeSwipe={onEdgeSwipe}
        shapeMode={isShapeMode}
        // ShowPicture is a .js dep whose inferred outline prop type is `null`
        // (default-only); the runtime accepts the F surface's Point[] outline.
        outline={(isShapeMode ? guessOutline : null) as unknown as null}
        onOutlineChange={isShapeMode ? applyGuessOutline : undefined}
        hiddenOutline={shape}
        revealToken={isShapeMode ? revealToken : undefined}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        enigmaOpen={isShapeMode ? shapeEnigmaOpen : undefined}
        onTargetDragPosition={isShapeMode ? undefined : dragPosition}
        surfaceOverlay={showModeCue ? <ModeCue imageDimensionStyle={imageDimensionStyle} /> : undefined}
      />
    );
  };

  if (showFilter) {
    return(
      <GameInstructions
        // pictureUri only in dev with local images
        uri={uri}
        game="guess"
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        imageIsPortrait={imageIsPortrait}
        handleFilterClick={handleFilterClick}
        imageDimensionStyle={imageDimensionStyle} />
    );
  };

  return (
    <>
      {renderPicture()}
      {/* E2E-only: real usage re-opens the enigma / exits via the ShowPicture
          edge double-tap; these explicit buttons stay so Maestro flows (and
          the deterministic single-tap outline seeding that must fall through
          to the surface) keep working untouched. */}
      {isShapeMode && isE2EMode() && (
        <>
          <Pressable
            accessibilityLabel={t('guess.shapeEnigmaLabel')}
            testID="game.picture.shape-enigma"
            style={styles.shapeEnigmaButton}
            onPress={handleShapeEnigmaPress}
          >
            <Text style={styles.shapeControlText}>{t('guess.shapeEnigmaLabel')}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t('guess.shapeExitLabel')}
            testID="game.picture.shape-exit"
            style={styles.shapeExitButton}
            onPress={handleShapeExitPress}
          >
            <Text style={styles.shapeControlText}>{t('guess.shapeExitLabel')}</Text>
          </Pressable>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  shapeEnigmaButton: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: GlobalStyle.color.scrim,
  },
  shapeExitButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: GlobalStyle.color.scrim,
  },
  shapeControlText: {
    color: GlobalStyle.color.onSurface,
  },
});

export default GuessPicture;
