import{ View, StyleSheet} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';


import BigButton from '../components/UI/BigButton';
import { GlobalStyle } from '../constants/theme';
import { handleOrientation } from '../utils/orientation';


import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import { toAlbum } from '../utils/errorLog';
import Button from '../components/UI/Button';


export default function HomeScreen({ navigation }) {

  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();


  useFocusEffect(() => {
    handleOrientation("portrait");
  });

  function navigationHandler({ screenName }) {
    navigation.navigate(screenName);
  };


  const toHidingPathScreen = () => {
    navigation.navigate('HidingPathScreen');
  };

  const toGuessPathScreen = () => {
    navigation.replace('GuessPathScreen');
  };

  const toRankingScreen = () => {
    navigation.navigate('RankingScreen');
  };


/*   const getPermissions = async () => {

    // Detect if you can request this permission again
    if (permissionResponse.status === "undetermined") {
      await requestPermission();
    };
    if (!permissionResponse.canAskAgain || permissionResponse.status === "denied") {
      Alert.alert("Insufficient Permissions", 'Access to  Photos and Videos / audio is denied');
      Linking.openSettings();
    } else {
      if (permissionResponse.status === "granted") {
        return true;
      };
    };
  }; */


/*   const exportLogToAlbum = async () => {

    let permissionStatus = await getPermissions();

    if (!permissionStatus) {
      return;
    };

    toAlbum();
  }; */

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
      <Button
        onPress={() => navigationHandler({ screenName: "LogScreen" })}>after you finish to play</Button>
    </View>
  );
};

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor500,
  },
})
