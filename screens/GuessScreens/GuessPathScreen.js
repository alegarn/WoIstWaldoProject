import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text } from 'react-native';

import SwipeImage from '../../components/UI/SwipeImage';
import SwipeInstructions from '../../components/Instructions/SwipeInstructions';
import TutorialOverlay from '../../components/UI/TutorialOverlay';
import { isE2EMode } from '../../utils/e2eMode';

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

export default function GuessPathScreen({ navigation, route }) {

  const [showOverlay, setShowOverlay] = useState(true);

  const isTutorial = route?.params?.isTutorial;

  const startGuessing = ({item}) => {
    navigation.replace('GuessScreen', {
      imageFile: item.imageFile,
      pictureId: item.pictureId,
      description: item.description,
      imageHeight: item.imageHeight,
      imageWidth: item.imageWidth,
      isPortrait: item.isPortrait,
      hiddenLocation: item.touchLocation,
      screenHeight: item.screenHeight,
      screenWidth: item.screenWidth,
      listId: item.listId,
      isTutorial: isTutorial
    });
  };

  return (
    <>
      {
        isE2EMode() && (
          <Pressable
            accessibilityLabel="Return to home"
            accessibilityRole="button"
            onPress={() => navigation.popToTop()}
            style={styles.e2eHomeButton}
            testID="guess-path.button.home"
          >
            <Text style={styles.e2eHomeButtonText}>Home</Text>
          </Pressable>
        )
      }
      {
        showOverlay ? (
          <>
            <SwipeInstructions
              screenWidth={SCREEN_WIDTH}
              imageIsPortrait={true}
              handleFilterClick={() => setShowOverlay(false)}
            />
            {
              isTutorial && 
                <TutorialOverlay
                  screen={"GuessPathScreen"}
                  instructionsPosition={{top:0, left: 0}}
                />
            }
          </>
        ) : (
          <SwipeImage
            screenWidth={SCREEN_WIDTH}
            screenHeight={SCREEN_HEIGHT}
            startGuessing={startGuessing}
          />
        )
      }
    </>
  );
};

const styles = StyleSheet.create({
  e2eHomeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(29, 19, 61, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  e2eHomeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});




