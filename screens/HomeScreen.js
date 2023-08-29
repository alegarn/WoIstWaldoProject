import{ View, StyleSheet} from 'react-native';
import { useLayoutEffect } from 'react';


import BigButton from '../components/UI/BigButton';
import { GlobalStyle } from '../constants/theme';
import { handleOrientation } from '../utils/orientation';


export default function HomeScreen({ navigation }) {

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  function navigationHandler({ screenName }) {
    navigation.navigate(screenName);
  };


  const toHidingPathScreen = () => {
    navigation.navigate('HidingPathScreen');
  };

  const toGuessPathScreen = () => {
    navigation.navigate('GuessPathScreen');
  };

  const toRankingScreen = () => {
    navigation.navigate('RankingScreen');
  };

  return (
    <View style={styles.homeContainer}>
      <BigButton
        text="Hide Waldo"
        onPress={toHidingPathScreen}
        buttonStyle="big" />
      <BigButton
        text="Find Waldo"
        onPress={toGuessPathScreen}
        buttonStyle="big" />
      <BigButton
        text="Ranking"
        onPress={toRankingScreen} />
    </View>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor500,
  },
})
