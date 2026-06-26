import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageAnimated from './ImageAnimated';
import TutorialOverlay from '../UI/TutorialOverlay';
import { navigateToNextGuess } from '../../utils/guessNavigation';



export default function ShowFailure({ navigation, route }) {

  const [showFailureImageAnimated, setShowSadImageAnimated] = useState(true);

  const { 
    imageFile, 
    pictureId, 
    description, 
    imageHeight, 
    imageWidth, 
    isPortrait, 
    hiddenLocation, 
    screenHeight, 
    screenWidth, 
    isTutorial,
    listId,
    category,
    language
  } = route?.params;


/* useEffect________________________________________________ */

  useEffect(() => {
    // stop the animation
    const timeout = setTimeout(() => {
      // 2 times
      console.log("showFailureImageAnimated", showFailureImageAnimated);
      setShowSadImageAnimated(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);


/* functions________________________________________________ */
  function retryGuess() {
    navigation.replace('GuessScreen', {
      imageFile: imageFile,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isTutorial: isTutorial
    });
  };

  const handleNextCard = async () => {
    const ok = await navigateToNextGuess(navigation, {
      category,
      language,
      currentListId: listId,
      isTutorial,
    });
    if (!ok) {
      navigation.reset({
        index: 2,
        routes: [
          { name: 'HomeScreen' },
          { name: 'GuessPathScreen', params: { isTutorial } },
          { name: 'GuessFeedScreen', params: { category, language } },
        ],
      });
    }
  };

  return (
    <>
      <View style={styles.container}>
        {
          showFailureImageAnimated ?
            <ImageAnimated success={false} />
          :
            <View testID="result.screen.failure">
              <Text style={styles.title}>You didn't find it :(</Text>
              <ResultChoices 
                navigation={navigation} 
                route={route}
                retryGuess={retryGuess} 
                success={false} 
                isTutorial={isTutorial} 
                onNextCard={handleNextCard}
              />
            </View>
        }
      </View>
      {
        isTutorial &&
          <TutorialOverlay
            screen={"ShowFailure"}
          />
      }
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },

});
