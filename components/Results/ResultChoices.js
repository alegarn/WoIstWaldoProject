import { View, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';

export default function ResultChoices({navigation, success, retryGuess}) {

  function returnHome() {
    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeScreen' }],
    });
  };


  function handleRetry() {
    retryGuess();
  };

  function backToSwipe() {
    navigation.reset({
      index: 1,
      routes: [{ name: 'GuessPathScreen' }],
    });
  };

  return(
    <View style={styles.buttonContainer}>
      <BigButton text="Go to Home" onPress={returnHome} />
      {success ?
        null
        : <BigButton text="Retry this one" onPress={handleRetry}/>}
      <BigButton text="Another one" onPress={backToSwipe} />
    </View>
  )
};


const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 16,
  },
})
