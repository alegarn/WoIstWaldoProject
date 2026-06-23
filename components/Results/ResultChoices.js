import { View, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';
import { useContext } from 'react';
import { AuthContext } from '../../store/auth-context';

export default function ResultChoices({ navigation, route, success, retryGuess, isTutorial }) {

  const context = useContext(AuthContext);

  const routeParams = route?.params ?? {};

  const returnHome = async () => {
    isTutorial
      && await context.updateTutorialStatus({ 
        isTutorial: true, 
        guessPathDone: true, 
        hidePathDone: context.isTutorialFinished?.hidePathDone 
      });
    
    navigation.reset({
      index: 0,
      routes: [{ 
        name: 'HomeScreen', 
        params: { isTutorial: isTutorial } 
      }],
    });
  };


  function handleRetry() {
    retryGuess();
  };

  function backToSwipe() {
    if (routeParams.category && routeParams.language) {
      navigation.reset({
        index: 3,
        routes: [
          { name: 'HomeScreen' },
          { name: 'GuessPathScreen', params: { isTutorial } },
          { name: 'GuessFeedScreen', params: { category: routeParams.category, language: routeParams.language } },
          { name: 'ResultScreen' },
        ],
      });
      return;
    }

    navigation.reset({
      index: 1,
      routes: [{ 
        name: 'GuessPathScreen', 
        params: { isTutorial: isTutorial } 
      }],
    });
  };

  return(
    <View style={styles.buttonContainer}>
      <BigButton accessibilityLabel="Go to home" testID="result.button.home" text="Go to Home" onPress={returnHome} />
      {
        success === false && 
          <BigButton 
            accessibilityLabel="Retry current guess"
            testID="result.button.retry"
            text="Retry this one" 
            onPress={handleRetry} 
          />
      }
      <BigButton accessibilityLabel="Guess another image" testID="result.button.another" text="Another one" onPress={backToSwipe} />
    </View>
  )
};


const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 16,
  },
})
