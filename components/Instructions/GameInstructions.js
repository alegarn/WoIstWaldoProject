import { View, Text, ImageBackground, StyleSheet } from "react-native";

import { Ionicons } from '@expo/vector-icons';

import BigButton from '../UI/BigButton';

export default function GameInstructions({ pictureUri, uri, screenHeight, screenWidth, handleFilterClick, game}) {

  // only in dev with local images
  const uriPict = uri ? { uri: uri } : pictureUri;
  /*  */


  let instructions = "Touch the screen to hide your Waldo!";
  game === "guess" ? instructions = "Guess where the Waldo is, touch the screen!" : null;

  return(
    <>
      <ImageBackground source={uriPict} style={[styles.image, { width: screenWidth, height: screenHeight }]}>
        <View style={styles.filter}>
          <Text style={styles.filterText}>{instructions}</Text>
          <BigButton text="Play!" onPress={handleFilterClick} buttonStyle="ranking" />
          <View style={styles.filterIconContainer}>
            <Text style={styles.filterText}>Touch the</Text>
            <Ionicons name={"close-circle-outline"} color={"white"} size={screenWidth/20}/>
            <Text style={styles.filterText}>again to confirm!</Text>
          </View>
        </View>
      </ImageBackground>
    </>
  )
}


const styles = StyleSheet.create({
  image: {
    resizeMode: 'contain',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  filter: {
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  filterIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterText: {
    color: 'white',
    fontSize: 23,
    fontWeight: 'bold',
    position: "relative",
    padding: 10,
  },
});
