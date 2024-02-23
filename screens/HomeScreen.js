import { useContext, useLayoutEffect } from 'react';
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
      return false;
    };

    if (response.status === 401) {
      context.logout();
      return false;
    };

    return true;
  };

  const verifyLoginInfos = async () => {
    const isToken = context.verifyIsLoggedIn();
    if (!isToken) {
      const response = await verifyTokenIsValid(context.token);
      response ? 
        null : 
        Alert.alert(
          "Error, your session has expired", 
          "Any upload will not be possible. \nPlease re-log in first");
    };

  };

  useLayoutEffect(() => {
    /* home debug message */
    /* Alert.alert("Welcome to WoIstWaldo Mode Debug", `Sorry for the inconvienience, actually i'm unable to replicate your bugs here (with android 13 / 14...), so do to that i need your help. \n\n
    Please choose an action to start, i put some programs to try gathering some data for you to help me debug \n\n
    When you have debug messages, copy them to the clipboard and would you please then send me the data? \n\n`); */
    /*  */

    Alert.alert("Welcome to WoIstWaldo !", "No debug mode this time")
  }, []);


  useFocusEffect(() => {
    handleOrientation("portrait");
    // when leaving the app 
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
