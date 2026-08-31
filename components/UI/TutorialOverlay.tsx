import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Image, Animated, type StyleProp, type ViewStyle, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INSTRUCTIONS } from '../../constants/instructions';

// Values for `${screen}ModalBtn` keys: an object on HomeScreen, a plain i18n key elsewhere.
type TutorialHomeButtonLabels = {
  hide: string;
  guess: string;
  finish: string;
};

type TutorialHomeActions = {
  Hide: () => void;
  Guess: () => void;
  finish: () => void;
};

type TutorialOverlayProps = {
  screen: string;
  instructionsPosition?: StyleProp<ViewStyle>;
  onPress?: TutorialHomeActions | (() => void);
  isPortrait?: boolean;
  onShowQuickTutorial?: () => void;
};

const TutorialOverlay = ({ screen, instructionsPosition, onPress, isPortrait, onShowQuickTutorial }: TutorialOverlayProps) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);
  const [instructions, setInstructions] = useState("instructions");
  const [closeButtonText, setCloseButtonText] = useState<string | TutorialHomeButtonLabels>("Close");
  const [imageUrl, setImageUrl] = useState<number>(require("../../assets/tutorial/farm_pict_320.jpg"));

  const translateInstruction = useCallback(
    (raw: string) => t(raw, { defaultValue: raw }),
    [t]
  );
  
  //ScrollBar states, variables
  const [completeScrollBarHeight, setCompleteScrollBarHeight] = useState(1);
  const [visibleScrollBarHeight, setVisibleScrollBarHeight] = useState(0);
  const [buttonIsVisible, setButtonIsVisible] = useState(false);
  
  const scrollIndicatorSize =
    completeScrollBarHeight > visibleScrollBarHeight
      ? (visibleScrollBarHeight * visibleScrollBarHeight) /
        completeScrollBarHeight
      : visibleScrollBarHeight;

      
  const difference = visibleScrollBarHeight > scrollIndicatorSize ? 
      visibleScrollBarHeight - scrollIndicatorSize
      : 1;
      
  const scrollIndicator = useRef(new Animated.Value(0)).current;
  
  const scrollIndicatorPosition = useMemo(
    () =>
      Animated.multiply(
        scrollIndicator,
        visibleScrollBarHeight / completeScrollBarHeight
      ).interpolate({
        inputRange: [0, difference],
        outputRange: [0, difference],
        extrapolate: 'clamp',
      }),
    [completeScrollBarHeight, difference, scrollIndicator, visibleScrollBarHeight]
  );

  const onScrollAnimatedEvent = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollIndicator } } }],
        { useNativeDriver: false }
      ),
    [scrollIndicator]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollAnimatedEvent(event);

      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 1) {
        setButtonIsVisible(true);
      }
    },
    [onScrollAnimatedEvent]
  );

  // Scrollbar end 

  // UseEffect ________________________________________________________________
  const updateImageUrl = useCallback((screen: string) => {
    switch (screen) {
      case 'HomeScreen':
        setImageUrl(require('../../assets/tutorial/farm_pict_home_320.jpg'));
        break;
      case 'HidingPathScreen':
        setImageUrl(require('../../assets/tutorial/farm_pict_320.jpg'));
        break;
      case 'HideScreen':
      case 'SetInstructionScreen':
      case 'GuessScreen':
        setImageUrl(require('../../assets/tutorial/farm_pict_hide_320.jpg'));
        break;
      case 'GuessPathScreen':
        setImageUrl(require('../../assets/tutorial/farm_pict_guess_320.jpg'));
        break;
      case 'ShowSuccess':
        setImageUrl(require('../../assets/tutorial/farm_pict_success_320.jpg'));
        break;
      case 'ShowFailure':
        setImageUrl(require('../../assets/tutorial/farm_pict_failure_320.jpg'));
        break;

      default:
        setImageUrl(require('../../assets/tutorial/farm_pict_320.jpg'));
        break;
    }
    return null;
  }, []);

  useEffect(() => {
    const tutorialInstructions = INSTRUCTIONS.Tutorial as Record<string, string | TutorialHomeButtonLabels | undefined>;
    setInstructions(tutorialInstructions[`${screen}`] as string);
    setCloseButtonText(tutorialInstructions[`${screen}ModalBtn`] as string | TutorialHomeButtonLabels);
    updateImageUrl(screen);
  }, [screen, updateImageUrl]);

  // Functions ________________________________________________________________
  const closeModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  const onPressAction = useCallback(() => {
    closeModal();
    if (typeof onPress === 'function') {
      onPress();
    }
  }, [closeModal, onPress]);

  const onQuickTutorialAction = useCallback(() => {
    closeModal();
    onShowQuickTutorial?.();
  }, [closeModal, onShowQuickTutorial]);

  return (
    <Modal transparent={true} animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        {/* This is the clear area that is clickable */}
        {/* <Pressable 
          style={[styles.clickableArea, { top: targetPosition?.top, left: targetPosition?.left }]} 
          onPress={onPress}
          > */}          
          {/* This could be used to show a border or some highlight */}
          {/* <View style={[styles.highlight, { height: highlightArea?.height, width: highlightArea?.width }]} />        
        </Pressable> */}

        {/* Arrow pointing to the clickable area */}
{/*         <View style={[styles.arrow, targetPosition ?? { top: targetPosition?.top + highlightArea?.height, left: targetPosition?.left + highlightArea?.width / 2 - 10 } ]} />
 */}
        {/* Instruction Modal */}
        <View style={styles.instructionModalContainer}>

          <View style={[styles.rowContainer, { maxHeight: buttonIsVisible ? '80%' : '95%' }]}>

            <ScrollView 
              style={[styles.instructionModal, instructionsPosition]}
              persistentScrollbar={true}

              contentContainerStyle={{ paddingRight: 3 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(width, height) => {
                setCompleteScrollBarHeight(height);
              }}
              onLayout={({
                nativeEvent: {
                  layout: { height },
                },
              }) => {
                setVisibleScrollBarHeight(height);
              }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              
              {
                isPortrait === true || isPortrait === undefined ? 
                  <Image source={imageUrl} style={styles.image}/> 
                  : 
                  isPortrait === false &&
                    <View style={styles.imageContainer}>
                      <Image source={imageUrl} style={styles.image}/>
                    </View>
              }
              
              <Text style={styles.instructions}>{translateInstruction(instructions)}</Text>
            </ScrollView>
            {/* scrollbar elements */}
            <View
              style={[styles.scrollbar, styles.scrollbarContainer]}
            >
              <Animated.View
                style={[
                  styles.scrollbar, 
                  styles.scrollbarIndicator,
                  {
                    height: scrollIndicatorSize,
                    transform: [{ translateY: scrollIndicatorPosition }]
                  }]
                }
              />
            </View>

          </View>
          
          {
            screen === "HomeScreen" ?

              buttonIsVisible === true ?
              (
                <View style={styles.buttonsContainer}>
                  
                  {
                    onShowQuickTutorial !== undefined &&
                    <Pressable
                      onPress={onQuickTutorialAction}
                      style={[styles.closeButton, styles.quickButton]}
                      testID="tutorial.overlay.quickBtn"
                    >
                      <Text style={styles.closeButtonText}>{translateInstruction(INSTRUCTIONS.Tutorial.HomeScreenQuickBtn)}</Text>
                    </Pressable>
                  }

                  <View style={styles.splitButtonContainer}>

                    <Pressable
                      onPress={() => (onPress as TutorialHomeActions)?.Hide()}
                      style={[styles.splitButton, styles.splitButtonLeft]}
                    >
                      <Text style={styles.closeButtonText}>{translateInstruction((closeButtonText as TutorialHomeButtonLabels)?.hide)}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => (onPress as TutorialHomeActions)?.Guess()}
                      style={[styles.splitButton, styles.splitButtonRight]}
                    >
                      <Text style={styles.closeButtonText}>{translateInstruction((closeButtonText as TutorialHomeButtonLabels)?.guess)}</Text>
                    </Pressable>

                  </View>

                  <Pressable onPress={() => (onPress as TutorialHomeActions)?.finish()} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>{translateInstruction((closeButtonText as TutorialHomeButtonLabels)?.finish)}</Text>
                  </Pressable>
                    
                </View>
              ) : null
              
            :

            buttonIsVisible === true ?
            (
            <View style={styles.buttonsContainer}>
              <Pressable onPress={onPressAction} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>{translateInstruction(closeButtonText as string)}</Text>
              </Pressable>
            </View>
            ) : null

          }

          
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionModalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxHeight: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
  },
  rowContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  instructionModal: {
    borderRadius: 10,
    alignContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  image: {
    maxWidth: '100%',
    minHeight: 80,
  },
  instructions: {
    fontSize: 18,
    color: 'black',
    textAlign: 'center',
  },
  scrollbar: {
    width: 6,
    borderRadius: 8,
  },
  scrollbarContainer: {
    height: "100%",
    backgroundColor: "#bc6ff1",
  },
  scrollbarIndicator: {
    backgroundColor: "#52057b",
  },
  buttonsContainer: {
    width: '100%',
    maxHeight: '20%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  button: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3498db',
    borderRadius: 5,
  },
  splitButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 5,
    backgroundColor: '#3498db',
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: 18,
    width: '100%',
  },
  splitButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  splitButtonLeft: {
    borderRightWidth: 1,
  },
  splitButtonRight: {
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 10,
    backgroundColor: 'red',
    borderRadius: 5,
    width: '100%',
  },
  quickButton: {
    backgroundColor: '#52057b',
    marginBottom: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  /*
  clickableArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  highlight: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 5,
    backgroundColor: 'rgba(240, 240, 240, 0.7)',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
  },
  */
});

export default TutorialOverlay;