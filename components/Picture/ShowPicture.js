import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import EnigmaOverlay from './Descriptions/EnigmaOverlay';
import SpeedRing from '../Guess/SpeedRing';
import ShapeCanvas from './ShapeCanvas';
import GuessShapeSurface from './GuessShapeSurface';
import MagnifierLoupe from './MagnifierLoupe';
import TraceInk from './TraceInk';
import TraceCorridorEdges from './TraceCorridorEdges';
import { useLoupe } from '../../hooks/useLoupe';
import { GlobalStyle } from '../../constants/theme';
import { SPEED_WINDOW_MS } from '../../utils/speedMultiplier';
import {
  LOUPE_ZOOM,
  LOUPE_DIAMETER_PX,
  LOUPE_LONG_PRESS_MS,
  LOUPE_MIRROR_STEP_PX,
  LOUPE_MIRROR_WINDOW_PX,
  windowPolyline,
} from '../../utils/loupeGeometry';
import { clampToImage } from '../../utils/shapeGeometry';
import { shapeTolerancePx } from '../../utils/shapeMatch';

const PULSE_DURATION_MS = 1200;
const PULSE_HALF_DURATION_MS = PULSE_DURATION_MS / 2;
const PULSE_SCALE_MIN = 1;
const PULSE_SCALE_MAX = 1.18;
const PULSE_OPACITY_MIN = 0.55;
const PULSE_OPACITY_MAX = 1;
const PULSE_NATIVE_DRIVER = { useNativeDriver: true };

// Surface swipe thresholds for the single RNGH surface detector. The legacy
// responder version lived in separate higher-zIndex subtrees that physically
// intercepted touches in the left 36px / bottom 28px — starving the target's
// drag. Moving detection INTO the picture subtree (the same subtree the target
// circle lives in) eliminates that cross-subtree barrier.
const EDGE_SWIPE_ACTIVE_X = 40;
const EDGE_SWIPE_FAIL_X = -10;
const EDGE_SWIPE_FAIL_Y = 40;
const HANDLE_SWIPE_ACTIVE_Y = -40;
const HANDLE_SWIPE_FAIL_Y = 10;

// Shape-mode double-tap zones (guess side): the surface swipe classifier is
// suppressed whole-mode, so the enigma/exit affordances move to a two-tap
// recognizer over the surface. A double tap within this many px of the bottom
// edge opens the enigma; within it of the left edge opens the exit menu. The
// bottom strip is classified FIRST so the bottom-left corner mirrors the
// point-mode priority (up beats right → enigma wins).
const DOUBLE_TAP_EDGE_ZONE_PX = 48;

export default function ShowPicture({ uri, guess, description, touchLocation, handlePress, handleLongPress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageDimensionStyle, targetGesture, defaultOpen, onDescriptionClosed, onEdgeSwipe, pulseTarget = false, speedRingActive = false, speedDurationMs = SPEED_WINDOW_MS, shapeMode = false, outline = null, onOutlineChange, hiddenOutline, imageWidth, imageHeight, enigmaOpen: enigmaOpenControl, onPointPlaced = undefined, onTargetDragPosition }) {
  const { t } = useTranslation();
  const pulseScale = useRef(new Animated.Value(PULSE_SCALE_MIN)).current;
  const pulseOpacity = useRef(new Animated.Value(PULSE_OPACITY_MAX)).current;

  // Loupe host (D2/D8/D9): the hook owns the ONLY animated values plus the
  // measurement refs. Dims are read late-bound at report() time — the ref is
  // null on first render, so imageDimensionStyle is the safe fallback.
  const loupe = useLoupe(imageDimensionStyle);
  const loupeRef = useRef(loupe);
  loupeRef.current = loupe;

  // D8: the ROOT container measures the container dims (screen space for the
  // frame clamp); the styles.pressable View below measures the root-relative
  // image origin. Unconditional ref writes — an async orientation lock can
  // re-layout the tree AFTER the first measure, and the SECOND layout carries
  // the true dims/origin. Ref writes are re-render-free; reapply() then
  // repositions an in-flight loupe (no new pointer event, no setState).
  const handleContainerLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    loupe.dimsRef.current = { width, height };
    loupeRef.current.reapply();
  };

  const handleImageOriginLayout = (event) => {
    const { x, y } = event.nativeEvent.layout;
    loupe.originRef.current = { x, y };
    loupeRef.current.reapply();
  };

  // Guess-side point drag: useTargetDrag (hosted by GuessPicture) threads the
  // live clamped target centre down as a prop; null clears (drag finalize).
  useEffect(() => {
    if (onTargetDragPosition === undefined) {
      return;
    }
    if (onTargetDragPosition === null) {
      loupeRef.current.hide();
      return;
    }
    if (!loupeRef.current.visible) {
      loupeRef.current.show();
    }
    loupeRef.current.report(onTargetDragPosition);
  }, [onTargetDragPosition]);

  const [enigmaOpen, setEnigmaOpen] = useState(!!defaultOpen);
  const previousDefaultOpenRef = useRef(!!defaultOpen);

  // Controlled enigma: defaultOpen is the parent's signal (e.g. skipInstructions
  // for reading-grace). When it flips, mirror into local open state so the
  // surface handle-swipe can later re-open after the user closes it.
  useEffect(() => {
    const previous = previousDefaultOpenRef.current;
    if (previous === !!defaultOpen) {
      return;
    }
    previousDefaultOpenRef.current = !!defaultOpen;
    if (defaultOpen) {
      setEnigmaOpen(true);
    }
  }, [defaultOpen]);

  // Controlled enigma for shape mode: while the surface classifier is
  // suppressed, the enigma-reopen affordance lives outside this subtree, so
  // the parent drives open/close through this channel (same mirror pattern
  // as defaultOpen above).
  const previousEnigmaOpenRef = useRef(null);
  useEffect(() => {
    if (enigmaOpenControl === undefined) {
      return;
    }
    if (previousEnigmaOpenRef.current === !!enigmaOpenControl) {
      return;
    }
    previousEnigmaOpenRef.current = !!enigmaOpenControl;
    setEnigmaOpen(!!enigmaOpenControl);
  }, [enigmaOpenControl]);

  useEffect(() => {
    if (!pulseTarget) {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: PULSE_SCALE_MAX,
            duration: PULSE_HALF_DURATION_MS,
            ...PULSE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseScale, {
            toValue: PULSE_SCALE_MIN,
            duration: PULSE_HALF_DURATION_MS,
            ...PULSE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: PULSE_OPACITY_MIN,
            duration: PULSE_HALF_DURATION_MS,
            ...PULSE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseOpacity, {
            toValue: PULSE_OPACITY_MAX,
            duration: PULSE_HALF_DURATION_MS,
            ...PULSE_NATIVE_DRIVER,
          }),
        ]),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      loop.reset();
    };
  }, [pulseTarget, pulseScale, pulseOpacity]);

  const pulseStyle = pulseTarget
    ? { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }
    : null;

  // Surface swipe classifier. A SINGLE Pan recognizer replaces the old
  // Race(edgeSwipe, handleSwipe): on Android that race mis-resolved a
  // bottom-up swipe — edgeSwipe (rightward) never failed on upward movement
  // (its failOffsetY was positive = down-only), so it lingered in BEGAN and
  // could win the race, opening the exit menu instead of the description.
  // One recognizer + a direction branch in onEnd removes the ambiguity: up
  // opens the enigma, right opens the exit menu. Up takes priority so a
  // bottom-up gesture always reaches the description even with drift.
  // While shapeMode is active the draw Pan lives in the same subtree (the
  // ShapeCanvas below), so the surface classifier is suppressed for the WHOLE
  // mode — not just mid-stroke — or the two recognizers race (see risks in
  // the shape-mode plan). Point mode keeps the chain untouched.
  const surfaceSwipe = useMemo(
    () => {
      const pan = Gesture.Pan()
        .activeOffsetX(EDGE_SWIPE_ACTIVE_X)
        .activeOffsetY(HANDLE_SWIPE_ACTIVE_Y)
        .failOffsetX(EDGE_SWIPE_FAIL_X)
        .failOffsetY(HANDLE_SWIPE_FAIL_Y)
        .onEnd((event, success) => {
          if (shapeMode || !success) {
            return;
          }
          if (event.translationY <= HANDLE_SWIPE_ACTIVE_Y) {
            setEnigmaOpen(true);
          } else if (event.translationX >= EDGE_SWIPE_ACTIVE_X) {
            onEdgeSwipe?.();
          }
        });
      return shapeMode ? pan.enabled(false) : pan;
    },
    [onEdgeSwipe, shapeMode],
  );

  // Hide-side point precision pan (Q10/D2): press-and-hold ~200ms enters
  // precision mode (loupe under the finger), drag fine-positions, release
  // places at the cursor. Built STRICTLY conditionally (point-hide only) so
  // the guess/shape sides never build a second Pan — a surface never carries
  // two recognizers with competing activation rules. The long-press gate is
  // mutually exclusive with the surface classifier's activeOffset rules: a
  // fast swipe cancels the long-press and flows to the classifier; a hold
  // never reaches the classifier's offsets first. Gesture coords are IMAGE-px
  // (the detector wraps the image-sized Pressable); clampToImage bounds them.
  const pointAnchorRef = useRef(null);
  const pointPrecisionPan = useMemo(() => {
    if (guess || shapeMode) {
      return null;
    }
    return Gesture.Pan()
      .activateAfterLongPress(LOUPE_LONG_PRESS_MS)
      .onBegin((event) => {
        pointAnchorRef.current = { x: event.x, y: event.y };
      })
      .onStart((event) => {
        const clamped = clampToImage(
          { x: event.x, y: event.y },
          imageDimensionStyle.width,
          imageDimensionStyle.height
        );
        pointAnchorRef.current = clamped;
        loupeRef.current.report(clamped);
        loupeRef.current.show();
      })
      .onUpdate((event) => {
        const clamped = clampToImage(
          { x: event.x, y: event.y },
          imageDimensionStyle.width,
          imageDimensionStyle.height
        );
        pointAnchorRef.current = clamped;
        loupeRef.current.report(clamped);
      })
      .onEnd(() => {
        loupeRef.current.hide();
        const anchor = pointAnchorRef.current;
        pointAnchorRef.current = null;
        if (anchor) {
          onPointPlaced?.(anchor);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guess, shapeMode, onPointPlaced, imageDimensionStyle?.width, imageDimensionStyle?.height]);

  // Shape-mode edge double-tap (guess side only): replaces the overlay
  // buttons that used to occlude the image (the surface classifier is
  // suppressed whole-mode while the draw Pan lives here). Built STRICTLY
  // conditionally (shape+guess only) — point modes never carry a second
  // recognizer, and taps without movement never trip the draw Pan while
  // strokes with movement fail the tap (same documented-safe nesting as the
  // surface classifier below). The detector hosts on a FULL-SCREEN wrapper
  // (see render below), so the zone classification uses the WRAPPER dims
  // measured via onLayout — screen edges, image border or not: bottom strip
  // → enigma, left strip → exit menu, corner → enigma wins (classified
  // first). While the confirm modal is up the tap is inert.
  const screenDimsRef = useRef(null);
  const handleScreenHostLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    screenDimsRef.current = { width, height };
  };

  const shapeEdgeDoubleTap = useMemo(() => {
    if (!shapeMode || !guess) {
      return null;
    }
    return Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event, success) => {
        if (!success || showModal) {
          return;
        }
        const dims = screenDimsRef.current;
        if (!dims) {
          return;
        }
        if (event.y >= dims.height - DOUBLE_TAP_EDGE_ZONE_PX) {
          setEnigmaOpen(true);
        } else if (event.x <= DOUBLE_TAP_EDGE_ZONE_PX) {
          onEdgeSwipe?.();
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeMode, guess, onEdgeSwipe, showModal]);

  // Shape-mode loupe mirror (D4/E2): the host builds the glass content from
  // the committed stroke points, TRIMMED to the trailing window around the
  // anchor (D6) so mirror cost stays O(window) as the stroke grows — ink AND
  // corridor edges consume the same slice. The MIRROR-COMMIT GATE (§7 budget
  // 2b) keeps the frame on EVERY report (animated, zero re-render) but commits
  // the content re-render only when the anchor moved ≥ LOUPE_MIRROR_STEP_PX
  // since the last mirror commit.
  const [shapeLoupePoints, setShapeLoupePoints] = useState(null);
  const lastMirrorAnchorRef = useRef(null);

  const handleStrokeUpdate = useCallback((info) => {
    if (!info) {
      lastMirrorAnchorRef.current = null;
      setShapeLoupePoints(null);
      loupeRef.current.hide();
      return;
    }
    if (!loupeRef.current.visible) {
      loupeRef.current.show();
    }
    loupeRef.current.report(info.anchor);
    const lastMirror = lastMirrorAnchorRef.current;
    if (
      !lastMirror ||
      Math.hypot(info.anchor.x - lastMirror.x, info.anchor.y - lastMirror.y) >=
        LOUPE_MIRROR_STEP_PX
    ) {
      lastMirrorAnchorRef.current = info.anchor;
      setShapeLoupePoints(
        windowPolyline(info.renderPoints, info.anchor, LOUPE_MIRROR_WINDOW_PX)
      );
    }
  }, []);

  // Point-mode loupe content (D4): the cursor is built into MagnifierLoupe,
  // so point modes mirror NOTHING; shape mode mirrors the live ink (both
  // sides) plus the corridor EDGE lines (guess only — never the fat band,
  // never the hidden outline). Children render in image-px inside the
  // loupe's scaled wrapper; the edges distance is the IMAGE-space tolerance.
  const loupeContent = shapeMode ? (
    <>
      <TraceInk points={shapeLoupePoints ?? []} />
      {guess ? (
        <TraceCorridorEdges
          trace={shapeLoupePoints ?? []}
          distance={shapeTolerancePx(imageWidth ?? 0, imageHeight ?? 0)}
        />
      ) : null}
    </>
  ) : null;

  // Redraw: clear the parent-owned outline and close the modal so a new
  // stroke can be drawn.
  const handleShapeRedraw = () => {
    onOutlineChange?.(null);
    onCancel?.();
  };

  const handleEnigmaClose = () => {
    onDescriptionClosed?.();
    setEnigmaOpen(false);
  };

  // When the target gesture is undefined (e2e mode or advance-state gating),
  // render the circle plain — GestureDetector accepts no gesture prop and
  // passes touches through to the Pressable underneath.
  const targetWrap = touchLocation && target?.dragStyle && (
    <Animated.View
      style={[target.dragStyle, styles.dragRing, pulseStyle]}
      testID={guess ? 'game.picture.guess-target-wrap' : 'game.picture.hide-target-wrap'}
    >
      <IconButton accessibilityLabel={t('game.picture.clearPointLabel')} icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} testID={guess ? 'game.picture.clear-guess' : 'game.picture.clear-hide'}/>
      {guess && speedRingActive && target?.dragSize > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.speedRingWrap]} pointerEvents="none">
          <SpeedRing size={target.dragSize} durationMs={speedDurationMs} active={speedRingActive} />
        </View>
      )}
    </Animated.View>
  );

  const surface = (
    <Pressable
      accessibilityLabel={guess ? t('game.picture.guessSurfaceLabel') : t('game.picture.hideSurfaceLabel')}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={StyleSheet.absoluteFill}
      testID={guess ? 'game.picture.guess-surface' : 'game.picture.hide-surface'}
    >
      <ImageBackground
        accessibilityLabel={guess ? t('game.picture.guessImageLabel') : t('game.picture.hideImageLabel')}
        source={{uri : uri}}
        resizeMode='stretch'
        style={styles.image}
        testID={guess ? 'game.picture.guess-image' : 'game.picture.hide-image'}
      >
{/* target not showing for guessscreen */}
        { guess ? (
          <EnigmaOverlay description={description} screenHeight={imageDimensionStyle.height} isOpen={enigmaOpen} onClose={handleEnigmaClose}/>
        ) : null }
      </ImageBackground>

      {shapeMode && (
        guess ? (
          <GuessShapeSurface
            imageDimensionStyle={imageDimensionStyle}
            outline={outline}
            onOutlineChange={onOutlineChange}
            hiddenOutline={hiddenOutline}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            onStrokeUpdate={handleStrokeUpdate}
          />
        ) : (
          <ShapeCanvas
            imageDimensionStyle={imageDimensionStyle}
            outline={outline}
            onOutlineChange={onOutlineChange}
            onStrokeUpdate={handleStrokeUpdate}
          />
        )
      )}

    </Pressable>
  );

  // The image-sized subtree (draw surface + target). Hosted as-is in point
  // modes; wrapped by the full-screen double-tap detector in shape+guess.
  const pictureSubtree = (
    <GestureDetector gesture={surfaceSwipe}>
      <View style={[styles.pressable, imageDimensionStyle]} onLayout={handleImageOriginLayout}>
        {/* Nesting a Pan detector around the surface Pressable is the
            documented-safe RNGH pattern: taps still fall through to onPress
            (same mechanism as the target drag detector over the surface —
            see hooks/useTargetDrag.ts:106-113). */}
        {pointPrecisionPan ? (
          <GestureDetector gesture={pointPrecisionPan}>{surface}</GestureDetector>
        ) : (
          surface
        )}

{/* no cross, when guess, if null  */}
        {targetGesture
          ? (
            <GestureDetector gesture={targetGesture}>
              {targetWrap}
            </GestureDetector>
          )
          : targetWrap}
      </View>
    </GestureDetector>
  );

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {shapeEdgeDoubleTap ? (
        // Full-screen double-tap host (shape+guess only): taps must register
        // near the SCREEN borders, not the image borders, so the recognizer
        // hosts on an absoluteFill wrapper with the same center/align layout
        // (the image stays centred). The loupe and modal below stay LATER
        // siblings so their scrims keep intercepting touches above it.
        <GestureDetector gesture={shapeEdgeDoubleTap}>
          <View
            style={[StyleSheet.absoluteFill, styles.pressable]}
            onLayout={handleScreenHostLayout}
          >
            {pictureSubtree}
          </View>
        </GestureDetector>
      ) : (
        pictureSubtree
      )}

      <MagnifierLoupe
        frameStyle={loupe.frameStyle}
        contentStyle={loupe.contentStyle}
        zoom={LOUPE_ZOOM}
        diameter={LOUPE_DIAMETER_PX}
        uri={uri}
        imageDimensionStyle={imageDimensionStyle}
      >
        {loupeContent}
      </MagnifierLoupe>

      {
        showModal &&
          <CenteredModal
            onPress={handleConfirm}
            onCancel={shapeMode ? handleShapeRedraw : onCancel}
            isModalVisible={showModal}
            testIDPrefix={guess ? 'game.picture.guess-modal' : 'game.picture.hide-modal'}
            confirmLabel={shapeMode ? t('game.picture.shapeConfirmLabel') : undefined}
            cancelLabel={shapeMode ? t('game.picture.shapeRedrawLabel') : undefined}
          >
            {t('game.picture.validate')}
          </CenteredModal>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dragRing: {
    borderWidth: 2,
    borderColor: GlobalStyle.color.primaryColor,
    backgroundColor: 'transparent',
  },
  speedRingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
