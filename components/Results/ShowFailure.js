import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import ResultChoices from './ResultChoices';
import TutorialOverlay from '../UI/TutorialOverlay';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { useAuthContext } from '../../store/auth-context';
import { flush } from '../../utils/sessionScoreStore';



export default function ShowFailure({ navigation, route }) {

  const authContext = useAuthContext();

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
    language,
    scope
  } = route?.params;

  const isPrivateScope = scope?.kind === 'private';

  const pulse = useRef(new Animated.Value(0)).current;

/* useEffect________________________________________________ */

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  useEffect(() => {
    void flush({ authContext });
  }, []);

  const messageScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });


/* functions________________________________________________ */
  function retryGuess() {
    const params = {
      imageFile: imageFile,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isTutorial: isTutorial,
      listId: listId,
      category: category,
      language: language,
    };

    if (isPrivateScope) {
      params.scope = scope;
    }

    navigation.replace('GuessScreen', params);
  };

  const handleNextCard = () => navigateToNextGuess(navigation, {
    category,
    language,
    currentListId: listId,
    isTutorial,
    scope: isPrivateScope ? scope : undefined,
  });

  return (
    <>
      <View style={styles.container}>
        <View testID="result.screen.failure" style={styles.result}>
          <Animated.Text
            testID="result.screen.failure.title"
            style={[styles.title, { transform: [{ scale: messageScale }] }]}
          >
            You didn't find it 😢
          </Animated.Text>
          <ResultChoices 
            navigation={navigation} 
            route={route}
            retryGuess={retryGuess} 
            success={false} 
            isTutorial={isTutorial} 
            onNextCard={handleNextCard}
          />
        </View>
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
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
    marginBottom: 16,
  },

});
