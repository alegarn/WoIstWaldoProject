import { useEffect, useState, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Image, Animated } from 'react-native';
import { INSTRUCTIONS } from '../../constants/instructions';

const TutorialOverlay =({ screen, instructionsPosition, onPress, isPortrait }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [instructions, setInstructions] = useState("instructions");
  const [closeButtonText, setCloseButtonText] = useState("Close");
  const [imageUrl, setImageUrl] = useState(require("../../assets/tutorial/farm_pict_320.jpg"));
  
  //ScrollBar states, variables
  const [completeScrollBarHeight, setCompleteScrollBarHeight] = useState(1);
  const [visibleScrollBarHeight, setVisibleScrollBarHeight] = useState(0);
  
  const scrollIndicatorSize =
    completeScrollBarHeight > visibleScrollBarHeight
      ? (visibleScrollBarHeight * visibleScrollBarHeight) /
        completeScrollBarHeight
      : visibleScrollBarHeight;

      
  const difference = visibleScrollBarHeight > scrollIndicatorSize ? 
      visibleScrollBarHeight - scrollIndicatorSize
      : 1;
      
  const scrollIndicator = useRef(new Animated.Value(0)).current;

  const scrollIndicatorPosition = Animated.multiply(
    scrollIndicator,
    visibleScrollBarHeight / completeScrollBarHeight
  ).interpolate({
    inputRange: [0, difference],
    outputRange: [0, difference],
    extrapolate: "clamp",
  });

  // Scrollbar end

  const updateImageUrl = (screen) => {
    switch (screen) {
      case "HomeScreen":
        setImageUrl(require("../../assets/tutorial/farm_pict_home_320.jpg"));
        break;  
      case "HidingPathScreen":
        setImageUrl(require("../../assets/tutorial/farm_pict_320.jpg"));
        break;
      case "HideScreen" && "SetInstructionScreen" && "GuessScreen":
        setImageUrl(require("../../assets/tutorial/farm_pict_hide_320.jpg"));
        break;
      case "GuessPathScreen":
        setImageUrl(require("../../assets/tutorial/farm_pict_guess_320.jpg"));
        break;
      case "ShowSuccess":
        setImageUrl(require("../../assets/tutorial/farm_pict_success_320.jpg"));
        break;
      case "ShowFailure":
        setImageUrl(require("../../assets/tutorial/farm_pict_failure_320.jpg"));
        break;

      default:
        setImageUrl(require("../../assets/tutorial/farm_pict_320.jpg"));
        break;
      };
      return null;
    };

  useEffect(() => {
    setInstructions(INSTRUCTIONS.Tutorial[`${screen}`]); 
    setCloseButtonText(INSTRUCTIONS.Tutorial[`${screen}ModalBtn`]);  
    updateImageUrl(screen);
  }, [screen]);

  const closeModal = () => {
    setIsVisible(false);
  };

  const onPressAction = () => {
    if (onPress !== undefined) {
      closeModal();
      onPress();
    };
    if (onPress === undefined) {
      closeModal();
    };
  };

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

          <View style={styles.rowContainer}>

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
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollIndicator } } }],
                { useNativeDriver: false }
              )}
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
              
              <Text style={styles.instructions}>{instructions}</Text>
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
              <View style={styles.buttonsContainer}>
                <View style={styles.splitButtonContainer}>

                  <Pressable 
                    onPress={() => onPress?.Hide()} 
                    style={[styles.splitButton, styles.splitButtonLeft]}
                  >
                    <Text style={styles.closeButtonText}>{closeButtonText?.hide}</Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => onPress?.Guess()} 
                    style={[styles.splitButton, styles.splitButtonRight]}
                  >
                    <Text style={styles.closeButtonText}>{closeButtonText?.guess}</Text>
                  </Pressable>

                </View>

                <Pressable onPress={() => onPress?.finish()} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>{closeButtonText?.finish}</Text>
                </Pressable>
                  
              </View>
            :
            <View style={styles.buttonsContainer}>
              <Pressable onPress={onPressAction} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>{closeButtonText}</Text>
              </Pressable>
            </View>
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
    maxHeight: '80%',
    overflow: 'hidden',
    flexDirection: 'column', // row or column
    padding: 10,
  },
  rowContainer: {
    flexDirection: 'row',
    width: '100%',
    height: '80%',
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
    height: '20%',
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
  },
  splitButton: {
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