import { Pressable, View, Text, ImageBackground, StyleSheet } from "react-native";

import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import BigButton from '../UI/BigButton';
import { isE2EMode } from '../../utils/e2eMode';

export default function GameInstructions({ uri, game, screenHeight, screenWidth, imageIsPortrait, handleFilterClick, imageDimensionStyle }) {
  const { t } = useTranslation();

  console.log("imageDimensionStyle", imageDimensionStyle);
  const isGuess = game === 'guess';
  const FilterContainer = isE2EMode() ? Pressable : View;
  const filterContainerProps = isE2EMode()
    ? {
        accessibilityLabel: t('game.instructions.dismissLabel', { game }),
        onPress: handleFilterClick,
        testID: `game.instructions.${game}.overlay`,
      }
    : {};

  const portraitUpperInstructions = ({ guess, imageIsPortrait }) => {

    if (!guess) {
      return (
        <Text style={styles.filterText}>{t('game.instructions.hidePrompt')}</Text>
      );
    };

    if (imageIsPortrait && guess) {
      return (
        <>
          <Text style={styles.filterText}>{t('game.instructions.guessPromptLine1')}</Text>
          <Text style={styles.filterText}>{t('game.instructions.guessPromptLine2')}</Text>
        </>
      );
    };

    if (!imageIsPortrait && guess) {
      return (
        <Text style={styles.filterText}>{t('game.instructions.guessPrompt')}</Text>
      );
    };
  };

  let instructionsSupplement = "";
  isGuess ? instructionsSupplement = (t('game.instructions.orShowDescription')): null;

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
              accessibilityLabel={t('game.instructions.startLabel', { game })}
              testID={`game.instructions.${game}.start`}
              text={t('game.instructions.play')}
              onPress={handleFilterClick}
              buttonStyle="ranking"
            />
          </View>

          <View style={[styles.filterIconContainer, styles.marginTop, portraitStyles]}>
            <View style={styles.filterIconContainer}>
              <Text style={[styles.filterText, imageIsPortrait ? {padding: 3} : {padding: 10}]}>{t('game.instructions.touchThe')}</Text>
              <Ionicons name={"close-circle-outline"} color={"white"} size={screenWidth/20}/>
            </View>
            <Text style={[styles.filterText, imageIsPortrait ? {padding: 3} : {padding: 10}]}>{t('game.instructions.againToConfirm')}</Text>
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
