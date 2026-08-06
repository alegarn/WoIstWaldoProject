import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import EnigmaOverlay from './Descriptions/EnigmaOverlay';
import SpeedRing from '../Guess/SpeedRing';
import { GlobalStyle } from '../../constants/theme';
import { SPEED_WINDOW_MS } from '../../utils/speedMultiplier';

const PULSE_DURATION_MS = 1200;
const PULSE_HALF_DURATION_MS = PULSE_DURATION_MS / 2;
const PULSE_SCALE_MIN = 1;
const PULSE_SCALE_MAX = 1.18;
const PULSE_OPACITY_MIN = 0.55;
const PULSE_OPACITY_MAX = 1;
const PULSE_NATIVE_DRIVER = { useNativeDriver: true };

// Surface swipe thresholds for the nested RNGH detectors. The legacy responder
// versions of these detectors lived in separate higher-zIndex subtrees that
// physically intercepted touches in the left 36px / bottom 28px — starving the
// target's drag. Moving detection INTO the picture subtree (the same subtree
// the target circle lives in) eliminates that cross-subtree barrier.
const EDGE_SWIPE_ACTIVE_X = 40;
const EDGE_SWIPE_FAIL_X = -10;
const EDGE_SWIPE_FAIL_Y = 40;
const HANDLE_SWIPE_ACTIVE_Y = -40;
const HANDLE_SWIPE_FAIL_Y = 10;

export default function ShowPicture({ uri, guess, description, touchLocation, handlePress, handleLongPress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageDimensionStyle, targetGesture, defaultOpen, onDescriptionClosed, onEdgeSwipe, pulseTarget = false, speedRingActive = false, speedDurationMs = SPEED_WINDOW_MS }) {
  const pulseScale = useRef(new Animated.Value(PULSE_SCALE_MIN)).current;
  const pulseOpacity = useRef(new Animated.Value(PULSE_OPACITY_MAX)).current;

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

  // Edge right-swipe → open exit menu. failOffsetX/Y ensure taps, vertical
  // swipes, and leftward swipes do NOT trigger the menu.
  const edgeSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(EDGE_SWIPE_ACTIVE_X)
        .failOffsetX(EDGE_SWIPE_FAIL_X)
        .failOffsetY(EDGE_SWIPE_FAIL_Y)
        .onEnd((_event, success) => {
          if (success) {
            onEdgeSwipe?.();
          }
        }),
    [onEdgeSwipe],
  );

  // Bottom up-swipe → open enigma. failOffsetY ensures taps and downward /
  // horizontal swipes do NOT trigger.
  const handleSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(HANDLE_SWIPE_ACTIVE_Y)
        .failOffsetY(HANDLE_SWIPE_FAIL_Y)
        .onEnd((_event, success) => {
          if (success) {
            setEnigmaOpen(true);
          }
        }),
    [],
  );

  const surfaceGesture = useMemo(
    () => Gesture.Race(edgeSwipe, handleSwipe),
    [edgeSwipe, handleSwipe],
  );

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
      <IconButton accessibilityLabel="Clear selected point" icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} testID={guess ? 'game.picture.clear-guess' : 'game.picture.clear-hide'}/>
      {guess && speedRingActive && target?.dragSize > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.speedRingWrap]} pointerEvents="none">
          <SpeedRing size={target.dragSize} durationMs={speedDurationMs} active={speedRingActive} />
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container} >
      <GestureDetector gesture={surfaceGesture}>
        <View style={[styles.pressable, imageDimensionStyle]}>
          <Pressable
            accessibilityLabel={guess ? 'Guess picture surface' : 'Hide picture surface'}
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={StyleSheet.absoluteFill}
            testID={guess ? 'game.picture.guess-surface' : 'game.picture.hide-surface'}
          >
            <ImageBackground
              accessibilityLabel={guess ? 'Guess picture image' : 'Hide picture image'}
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

          </Pressable>

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

      {
        showModal &&
          <CenteredModal
            onPress={handleConfirm}
            onCancel={onCancel}
            isModalVisible={showModal}
            testIDPrefix={guess ? 'game.picture.guess-modal' : 'game.picture.hide-modal'}
          >
            {"Do you want to validate this ?"}
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
