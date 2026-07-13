import { useEffect, useRef } from 'react';
import { Animated, View, Pressable, StyleSheet, ImageBackground } from 'react-native';

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

export default function ShowPicture({ uri, guess, description, touchLocation, handlePress, handleLongPress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageDimensionStyle, targetPanHandlers, defaultOpen, pulseTarget = false, speedRingActive = false, speedDurationMs = SPEED_WINDOW_MS }) {
  const pulseScale = useRef(new Animated.Value(PULSE_SCALE_MIN)).current;
  const pulseOpacity = useRef(new Animated.Value(PULSE_OPACITY_MAX)).current;

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

  return (
    <View style={styles.container} >
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
              <EnigmaOverlay description={description} screenHeight={imageDimensionStyle.height} defaultOpen={defaultOpen}/>
            ) : null }
          </ImageBackground>

        </Pressable>

{/* no cross, when guess, if null  */}
        {touchLocation && target?.dragStyle && (
          <Animated.View
            {...(targetPanHandlers || {})}
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
        )}
      </View>

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
