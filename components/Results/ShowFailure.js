import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';


export default function ShowFailure({ navigation, route }) {

  const { accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth } = route.params;

  console.log("isPortrait", isPortrait);

  function retryGuess() {
    navigation.replace('GuessScreen', {
      accountId: accountId,
      imageFile: imageFile,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth });
  };

  return (
      <View style={styles.container}>
        <Text style={styles.title}>You didn't found it :O</Text>
        <ResultChoices navigation={navigation} retryGuess={retryGuess} success={false} />
      </View>
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
})
