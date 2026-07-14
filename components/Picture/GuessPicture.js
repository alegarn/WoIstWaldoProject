import { useState, useLayoutEffect, useMemo, useRef, useEffect } from 'react';
import { PanResponder } from 'react-native';

import { handleImageOrientation } from "../../utils/orientation";
import {
  buildCenteredTarget,
  buildSelectionFromPixels,
} from "../../utils/targetLocation";

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

const TAP_THRESHOLD = 8;
const TIMER_TICK_MS = 100;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function GuessPicture({ imageFile, description, imageIsPortrait, imageHeight, imageWidth, hiddenLocation, screenDimensions, toAdScreen, skipInstructions, pulseTarget = false, onInteract }) {

  const [showFilter, setShowFilter] = useState(!skipInstructions);

  // Reading grace delays the chrono on 2nd+ cards (skipInstructions) while the
  // enigma opens by default. Ends at the earliest of graceMs or description close.
  const { graceDone, markClosed } = useReadingGrace({ enabled: skipInstructions === true && !isE2EMode() });

  const uri = imageFile;
  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  const isPortrait = imageIsPortrait;
  const { maxImageHeight, maxImageWidth } = setImageDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });
  const imageDimensionStyle = { width: maxImageWidth, height: maxImageHeight };

  const initialSelection = useMemo(
    () => isE2EMode() ? null : buildCenteredTarget({ screenWidth, screenHeight, imageDimensionStyle }),
    []
  );

  const [touchLocation, setTouchLocation] = useState(initialSelection?.location ?? null);
  const [target, setTarget] = useState(initialSelection?.target ?? null);
  const [showModal, setShowModal] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedAccumRef = useRef(0);
  const runStartRef = useRef(0);
  const intervalRef = useRef(null);

/* debug */
  /* const [showDebugModal, setShowDebugModal] = useState(false);

  const toggleDebugModal = () => {
    setShowDebugModal(!showDebugModal);
  }; */
/*  */

  const dragStartRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({ target, screenWidth, screenHeight, imageDimensionStyle });
  stateRef.current = { target, screenWidth, screenHeight, imageDimensionStyle };

  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const targetPanHandlers = useMemo(
    () => {
      if (isE2EMode()) {
        return undefined;
      }
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          onInteractRef.current?.();
          const { target: currentTarget } = stateRef.current;
          const half = (currentTarget?.targetSize ?? 0) / 2;
          dragStartRef.current = {
            x: (currentTarget?.targetStyle?.left ?? 0) + half,
            y: (currentTarget?.targetStyle?.top ?? 0) + half,
          };
        },
        onPanResponderMove: (_event, gestureState) => {
          const { screenWidth: sw, screenHeight: sh, imageDimensionStyle: dims } = stateRef.current;
          const nextX = clamp(dragStartRef.current.x + gestureState.dx, 0, dims.width);
          const nextY = clamp(dragStartRef.current.y + gestureState.dy, 0, dims.height);
          const selection = buildSelectionFromPixels({
            locationX: nextX,
            locationY: nextY,
            screenWidth: sw,
            screenHeight: sh,
            imageDimensionStyle: dims,
          });
          setTouchLocation(selection.location);
          setTarget(selection.target);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const moved = Math.hypot(gestureState.dx, gestureState.dy);
          if (moved < TAP_THRESHOLD) {
            setShowModal(true);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }).panHandlers;
    },
    []
  );

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({imageIsPortrait});
  }, [imageIsPortrait]);

  useEffect(() => {
    if (isE2EMode()) {
      setElapsedMs(0);
      return undefined;
    }
    if (showFilter || showModal || !graceDone) {
      return undefined;
    }
    runStartRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsedMs(elapsedAccumRef.current + (Date.now() - runStartRef.current));
    }, TIMER_TICK_MS);
    return () => {
      elapsedAccumRef.current += Date.now() - runStartRef.current;
      clearInterval(intervalRef.current);
    };
  }, [showFilter, showModal, graceDone]);

  const handleFilterClick = () => {
    setShowFilter(false);
  };

  const selectPictureLocation = ({ relativeLocation }) => {
    const selection = buildE2EPictureSelection({
      screenWidth,
      screenHeight,
      imageDimensionStyle,
      relativeLocation,
    });

    const { location, target } = selection;
    if (location && target) {
      setTouchLocation(location);
      setTarget(target);
    }
  };

  const handlePress = (event) => {
    if (!isE2EMode()) return; // real usage: target is drag-only; image tap does not move it
    selectPictureLocation({
      event,
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
    toAdScreen({ location: touchLocation, hiddenLocation, screenWidth, screenHeight, target, elapsedMs });
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
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        touchLocation={touchLocation}
        handlePress={handlePress}
        handleLongPress={handleLongPress}
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        targetPanHandlers={targetPanHandlers}
        defaultOpen={skipInstructions === true}
        pulseTarget={pulseTarget}
        speedRingActive={!showFilter && !showModal && graceDone && !isE2EMode()}
        speedDurationMs={SPEED_WINDOW_MS}
        onDescriptionClosed={markClosed}
        /* for debug */
       /*  showDebugModal={showDebugModal}
        setShowDebugModal={toggleDebugModal} */
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
}
