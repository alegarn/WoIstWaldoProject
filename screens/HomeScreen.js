import { useContext } from 'react';
import{ View, StyleSheet, Alert} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

import BigButton from '../components/UI/BigButton';
import { GlobalStyle } from '../constants/theme';
import { handleOrientation } from '../utils/orientation';
import { AuthContext } from '../store/auth-context';
import { getScoreId } from '../utils/auth';

export default function HomeScreen({ navigation }) {

  const context = useContext(AuthContext);


  const verifyTokenIsValid = async () => {
    const response = await getScoreId(context);
    
    if (response.status !== 200 && response.status !== 401) {
      Alert.alert("Error, there is a server problem.", "Any upload will not be possible. \nPlease wait and try again later");
    };

    if (response.status === 401) {
      Alert.alert("Error, your session has expired", "Any upload will not be possible. \nPlease re-log in first");
      context.logout();
    };


  };

  const verifyLoginInfos = async () => {
    const isToken = context.verifyIsLoggedIn();
    if (!isToken) {
      Alert.alert("Error, your session has expired", "Any upload will not be possible. \nPlease re-log in first");
    };
    
    const response = await verifyTokenIsValid(context.token);

  };


  useFocusEffect(() => {
    handleOrientation("portrait");
    verifyLoginInfos();
  });

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
