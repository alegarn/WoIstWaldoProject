import { Pressable, View, Text, ImageBackground, StyleSheet } from "react-native";

import { Ionicons } from '@react-native-vector-icons/ionicons';

import BigButton from '../UI/BigButton';
import { isE2EMode } from '../../utils/e2eMode';

export default function GameInstructions({ uri, game, screenHeight, screenWidth, imageIsPortrait, handleFilterClick, imageDimensionStyle }) {

  console.log("imageDimensionStyle", imageDimensionStyle);
  const isGuess = game === 'guess';
  const FilterContainer = isE2EMode() ? Pressable : View;
  const filterContainerProps = isE2EMode()
    ? {
        accessibilityLabel: `Dismiss ${game} instructions overlay`,
        onPress: handleFilterClick,
        testID: `game.instructions.${game}.overlay`,
      }
    : {};

  const portraitUpperInstructions = ({ guess, imageIsPortrait }) => {

    if (!guess) {
      return (
        <Text style={styles.filterText}>Touch the screen to hide your Waldo!</Text>
      );
    };

    if (imageIsPortrait && guess) {
      return (
        <>
          <Text style={styles.filterText}>Guess where the Waldo is,</Text>
          <Text style={styles.filterText}>touch the screen!</Text>
        </>
      );
    };

    if (!imageIsPortrait && guess) {
      return (
        <Text style={styles.filterText}>Guess where the Waldo is, touch the screen!</Text>
      );
    };
  };

  let instructionsSupplement = "";
  isGuess ? instructionsSupplement = ("or show the description"): null;

  let portraitStyles = {
    flexDirection: 'column',
  };

  imageIsPortrait ? null : portraitStyles = null;

  return(
    <View style={styles.container}>
      <ImageBackground
        source={{uri : uri}}
        resizeMode="stretch"
        style={imageDimensionStyle}>
        <FilterContainer style={styles.filter} {...filterContainerProps}>

          <View style={styles.marginTop}>
            {portraitUpperInstructions({ guess: isGuess, imageIsPortrait })}
          </View>

          <View style={styles.marginTop}>
            <BigButton
              accessibilityLabel={`Start ${game} instructions`}
              testID={`game.instructions.${game}.start`}
              text="Play!"
              onPress={handleFilterClick}
              buttonStyle="ranking"
            />
          </View>

          <View style={[styles.filterIconContainer, styles.marginTop, portraitStyles]}>
            <View style={styles.filterIconContainer}>
              <Text style={[styles.filterText, imageIsPortrait ? {padding: 3} : {padding: 10}]}>Touch the</Text>
              <Ionicons name={"close-circle-outline"} color={"white"} size={screenWidth/20}/>
            </View>
            <Text style={[styles.filterText, imageIsPortrait ? {padding: 3} : {padding: 10}]}>again to confirm</Text>
            <Text style={[styles.filterText, imageIsPortrait ? {padding: 3} : {padding: 10}]}>{instructionsSupplement}</Text>
          </View>

        </FilterContainer>
      </ImageBackground>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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

  marginTop: {
    marginTop: 10,
  },
  filterIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  filterText: {
    color: 'white',
    fontSize: 23,
    fontWeight: 'bold',
    position: "relative",
  },
});
