import{ View, StyleSheet} from 'react-native';

import HomeButton from '../components/UI/HomeButton';
import { GlobalStyle } from '../constants/theme';



export default function HomeScreen({ navigation }) {
  function navigationHandler({ screenName }) {
    navigation.navigate(screenName);
  };

  return (
    <View style={styles.homeContainer}>
      <HomeButton
        text="Hide Waldo"
        onPress={() => navigationHandler({ screenName: 'HideScreen' })}
        buttonStyle="big" />
      <HomeButton
        text="Find Waldo"
        onPress={() => navigationHandler({ screenName: 'FindScreen' })}
        buttonStyle="big" />
      <HomeButton
        text="Ranking"
        onPress={() => navigationHandler({ screenName: 'RankingScreen' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor100,
  },
})
