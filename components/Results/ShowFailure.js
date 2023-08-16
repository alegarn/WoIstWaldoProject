import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageFilter from './ImageFilter';



export default function ShowFailure({ navigation, route }) {

  const [showSadImageFilter, setShowSadImageFilter] = useState(true);

  const { accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth } = route.params;



  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowSadImageFilter(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);



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
    <>

        <View style={styles.container}>
          {showSadImageFilter ?
            <ImageFilter success={false} />
          :
          <>
            <Text style={styles.title}>You didn't find it :(</Text>
            <ResultChoices navigation={navigation} retryGuess={retryGuess} success={false} />
          </>
          }
        </View>
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
