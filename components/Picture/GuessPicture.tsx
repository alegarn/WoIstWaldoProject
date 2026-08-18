import { useState, useLayoutEffect, useMemo } from 'react';
import type { FC } from 'react';

import { handleImageOrientation } from '../../utils/orientation';
import { buildCenteredTarget } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';
import { setImageDimensions } from '../../utils/imageDimensions';
import {
  buildE2EPictureSelection,
  getE2EHideLocation,
  getE2EIncorrectHideLocation,
  isE2EMode,
} from '../../utils/e2eMode';
import { SPEED_WINDOW_MS } from '../../utils/speedMultiplier';
import { useReadingGrace } from '../../hooks/useReadingGrace';
import { useSpeedTimer } from '../../hooks/useSpeedTimer';
import { useTargetDrag } from '../../hooks/useTargetDrag';

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

type ToAdScreenArgs = {
  location: SelectionLocation | null;
  hiddenLocation?: HiddenLocation;
  screenWidth: number;
  screenHeight: number;
  target: SelectionTarget | null;
  elapsedMs: number;
};

type GuessPictureProps = {
  navigation?: unknown;
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageIsPortrait?: boolean;
  imageHeight?: number;
  imageWidth?: number;
  hiddenLocation?: HiddenLocation;
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
  screenDimensions,
  toAdScreen,
  skipInstructions,
  pulseTarget = false,
  onInteract,
  disabled = false,
  onEdgeSwipe,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const showFilter = !skipInstructions && !dismissed;

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
    enabled: !isE2EMode() && !disabled,
    screenWidth,
    screenHeight,
    imageDimensionStyle,
    initialSelection,
    onInteract,
    onTap: () => setShowModal(true),
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

  const handlePress = () => {
    if (!isE2EMode()) return; // real usage: target is drag-only; image tap does not move it
    selectPictureLocation({
      relativeLocation: hiddenLocation ?? getE2EHideLocation(),
    });
  };

  const handleLongPress = () => {
    if (!isE2EMode()) {
      return;
    }

    selectPictureLocation({
      relativeLocation: getE2EIncorrectHideLocation(),
    });
  };

  const handleIconPress = () => {
    onInteract?.();
    setShowModal(true);
  };

  const handleConfirm = () => {
    onInteract?.();
    setShowModal(false);
    toAdScreen?.({ location: touchLocation, hiddenLocation, screenWidth, screenHeight, target, elapsedMs });
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
        touchLocation={touchLocation}
        handlePress={handlePress}
        handleLongPress={handleLongPress}
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        targetGesture={targetGesture}
        defaultOpen={skipInstructions === true}
        pulseTarget={pulseTarget}
        speedRingActive={!showFilter && !showModal && graceDone && !isE2EMode()}
        speedDurationMs={SPEED_WINDOW_MS}
        onDescriptionClosed={markClosed}
        onEdgeSwipe={onEdgeSwipe}
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

  return renderPicture();
};

export default GuessPicture;
