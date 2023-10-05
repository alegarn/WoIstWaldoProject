import { View, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';

export default function ResultChoices({navigation, success, retryGuess}) {

  function returnHome() {
    navigation.replace('HomeScreen');
  };


  function handleRetry() {
    retryGuess();
  };

  return(
    <View style={styles.buttonContainer}>
      <BigButton text="Go to Home" onPress={returnHome} />
      {success ?
        null
        : <BigButton text="Retry this one" onPress={handleRetry}/>}
      <BigButton text="Another one" onPress={() => navigation.navigate("GuessPathScreen")} />
    </View>
  )
};


const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 16,
  },
})
