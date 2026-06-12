import { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, Alert} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import HomeCard from '../components/UI/HomeCard';
import { GlobalStyle } from '../constants/theme';
import { handleOrientation } from '../utils/orientation';
import { AuthContext } from '../store/auth-context';
import { getScoreId } from '../utils/auth';
import { isTutorialFinished } from '../utils/tutorialHandler';

import * as SecureStore from 'expo-secure-store';
import CenteredModal from '../components/UI/CenteredModal';
import TutorialOverlay from '../components/UI/TutorialOverlay';
import IconButton from '../components/UI/IconButton';

const HideImage = require('../assets/home/WoIstWaldo-character-hide.png');
const MainImage = require('../assets/home/WoIstWaldo-character-main.png');
const RankingImage = require('../assets/tutorial/farm_pict_home_320.jpg');

export default function HomeScreen({ navigation, route }) {
  // States __________________________________________________________________
  const [showModal, setShowModal] = useState(false);
  const [isTutorial, setIsTutorial] = useState(false);

  // Variables __________________________________________________________________
  const context = useContext(AuthContext);

  /* functions ___________________________________________________________________ */
  const verifyTokenIsValid = async () => {
    const response = await getScoreId(context);
    
    if (response?.status !== 200 && response?.status !== 401) {
      Alert.alert("Error, there is a server problem.", "Any upload will not be possible. \nPlease wait and try again later");
      return false;
    };

    if (response?.status === 401) {
      context.logout();
      return false;
    };

    return true;
  };

  const verifyLoginInfos = async () => {
    const isToken = await context.verifyIsLoggedIn();
    if (!isToken) {
      const response = await verifyTokenIsValid(context.token);
      response ? 
        null : 
        Alert.alert(
          "Error, your session has expired", 
          "Any upload will not be possible. \nPlease re-log in first");
    };
    return null;
  };

/*   const checkSecureStoreOk = async () => {
    const isSecureStoreOk = await SecureStore.isAvailableAsync()
      .then((promiseResult) => {
        if (promiseResult) {
          return true;
        } else {
          return false;
        };
      });
    Alert.alert("Welcome to WoIstWaldo !", `No debug mode this time, \n Can you use SecureStore ? : ${isSecureStoreOk}`);
    return null;
  };
 */
  const handleTutorialModalToShow = (isTutorial, guessPathDone, hidePathDone) => {

    // Not doing the tutorial yet
    if ((isTutorial === true) && (route?.params?.isTutorial === undefined)) {
      setShowModal(true) 
      return;
    };

    // Already in the tutorial ?
    if ((isTutorial === true) && (route?.params?.isTutorial === true)) {
      setIsTutorial(true)
    };

    // Is tutorial completed ?
    if ((isTutorial === true) && (guessPathDone === true) && (hidePathDone === true)) {
      setIsTutorial(false);
      setShowModal(false);
    };

  };

  const isTutorialNeeded = () => {
    const isTutorial = context.isTutorialFinished?.isTutorial;
    const guessPathDone = context.isTutorialFinished?.guessPathDone;
    const hidePathDone = context.isTutorialFinished?.hidePathDone;
    isTutorial && handleTutorialModalToShow(isTutorial, guessPathDone, hidePathDone);
  };

  /* Functions _______________________________ */

  const toHidingPathScreen = () => {
    navigation.navigate('HidingPathScreen');
  };

  const toGuessPathScreen = () => {
    navigation.navigate('GuessPathScreen');
  };

  const toRankingScreen = () => {
    navigation.navigate('RankingScreen');
  };

  const cancelTutorial = async () => {
    await context.turnTutorialOn(false);
    await isTutorialFinished({ 
      context, 
      data: {
        user: {
          is_tutorial_finished: true
        }
      } 
    });
  
    setIsTutorial(false);
    setShowModal(false);
    return false;
  };

  const startTutorial = async () => {
    await context.turnTutorialOn(true);
    setIsTutorial(true);
  };

  const toGuessTutorial = () => {
    navigation.replace('GuessPathScreen', {
      isTutorial: true,
    });
  };

  const toHideTutorial = () => {
    navigation.replace('HidingPathScreen', {
      isTutorial: true,
    });
  };

  /* useEffect _______________________________ */

  useEffect(() => {
    /* To delete - home debug message */
    /* Alert.alert("Welcome to WoIstWaldo Mode Debug", `Sorry for the inconvienience, actually i'm unable to replicate your bugs here (with android 13 / 14...), so do to that i need your help. \n\n
    Please choose an action to start, i put some programs to try gathering some data for you to help me debug \n\n
    When you have debug messages, copy them to the clipboard and would you please then send me the data? \n\n`); */
    /*  */

    // checkSecureStoreOk();

    //Alert.alert("Welcome to WoIstWaldo !", `No debug mode this time, \n Can you use SecureStore ? : ${checkSecureStoreOk()}`);
  }, []);

  useEffect(() => {
    isTutorialNeeded(); 
    }, [context.isTutorialFinished]
  );


  useFocusEffect(() => {
    handleOrientation("portrait");
    // when leaving the app 
    void verifyLoginInfos();
  });

  return (
    <>
      <View style={styles.homeContainer}>
        <HomeCard
          text="Hide Waldo"
          onPress={toHidingPathScreen}
          backgroundImage={HideImage}
          heightPercent={40}
          testID="home.button.hide"
        />
        <HomeCard
          text="Find Waldo"
          onPress={toGuessPathScreen}
          backgroundImage={MainImage}
          heightPercent={40}
          testID="home.button.guess"
        />
        <HomeCard
          text="Ranking"
          onPress={toRankingScreen}
          backgroundImage={RankingImage}
          heightPercent={20}
          testID="home.button.ranking"
        />
        {
          showModal && 
          <CenteredModal 
            isModalVisible={showModal}
            children={"Welcome, do you want to do the tutorial? \n\n It will help you to learn how to play the game in 5 minutes. \n\n Later it is possible to do it again."} 
            onCancel={() => cancelTutorial()} 
            onPress={() => startTutorial()}
            testIDPrefix="home.tutorial-modal"
            />
        }
        {
          isTutorial &&
          <TutorialOverlay
            screen="HomeScreen"
            onPress={{
              Guess: () => toGuessTutorial(), 
              Hide: () => toHideTutorial(),
              finish: () => cancelTutorial()
            }}
            />
        }

      </View>
      <IconButton
        accessibilityLabel="Open tutorial"
        icon={"book"}
        color={"white"}
        size={24}
        style={styles.tutorialButton}
        onPress={() => setIsTutorial(true)}
        testID="home.button.tutorial"
      />
  </>
    
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor900,
    padding: 10,
    gap: 10, // Use gap for spacing between cards
  },
  tutorialButton: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 1
  },
})
