import { View, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';
import { useContext } from 'react';
import { AuthContext } from '../../store/auth-context';

export default function ResultChoices({ navigation, success, retryGuess, isTutorial }) {

  const context = useContext(AuthContext);

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
      <BigButton text="Go to Home" onPress={returnHome} />
      {
        success === false && 
          <BigButton 
            text="Retry this one" 
            onPress={handleRetry} 
          />
      }
      <BigButton text="Another one" onPress={backToSwipe} />
    </View>
  )
};


const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 16,
  },
})
