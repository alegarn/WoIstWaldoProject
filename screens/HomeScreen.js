import { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, Alert} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import BigButton from '../components/UI/BigButton';
import { GlobalStyle } from '../constants/theme';
import { handleOrientation } from '../utils/orientation';
import { AuthContext } from '../store/auth-context';
import { getScoreId } from '../utils/auth';
import { setIsTutorialFinished } from '../utils/tutorialHandler';

import * as SecureStore from 'expo-secure-store';
import CenteredModal from '../components/UI/CenteredModal';
import TutorialOverlay from '../components/UI/TutorialOverlay';
import IconButton from '../components/UI/IconButton';

export default function HomeScreen({ navigation, route }) {
  const [showModal, setShowModal] = useState(false);
  const [isTutorial, setIsTutorial] = useState(false);

  const context = useContext(AuthContext);

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
    const isToken = context.verifyIsLoggedIn();
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

  const checkSecureStoreOk = async () => {
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

  const isTutorialNeeded = async () => {
    // fire the tutorial if needed after context is done updated on login
    setTimeout(() => {
      let isTutorial = context.isTutorialFinished?.isTutorial;
      let guessPathDone = context.isTutorialFinished?.guessPathDone;
      let hidePathDone = context.isTutorialFinished?.hidePathDone;
      
      const tutorialModalIsShown = 
        ((isTutorial === true) || (route?.params?.isTutorial === true))
        && ((guessPathDone === false) || (hidePathDone === false));
      console.log(`tutorialModalIsShown: ${tutorialModalIsShown}`);
      tutorialModalIsShown ? 
        setShowModal(true) 
        : setShowModal(false);  
    }, 250);
  };


  /* useEffect _______________________________ */

  useEffect(() => {
    /* To delete - home debug message */
    /* Alert.alert("Welcome to WoIstWaldo Mode Debug", `Sorry for the inconvienience, actually i'm unable to replicate your bugs here (with android 13 / 14...), so do to that i need your help. \n\n
    Please choose an action to start, i put some programs to try gathering some data for you to help me debug \n\n
    When you have debug messages, copy them to the clipboard and would you please then send me the data? \n\n`); */
    /*  */
    checkSecureStoreOk();
    isTutorialNeeded(); 
    //Alert.alert("Welcome to WoIstWaldo !", `No debug mode this time, \n Can you use SecureStore ? : ${checkSecureStoreOk()}`);
  }, []);


  useFocusEffect(() => {
    handleOrientation("portrait");
    // when leaving the app 
    verifyLoginInfos();
  });


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
    await setIsTutorialFinished({ 
      context, 
      data: {is_tutorial_finished: true} 
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

  return (
    <>
      <View style={styles.homeContainer}>
        <BigButton
          text="Hide Waldo"
          onPress={toHidingPathScreen}
          buttonStyle="big"
          />
        <BigButton
          text="Find Waldo"
          onPress={toGuessPathScreen}
          buttonStyle="big" 
          />
        <BigButton
          text="Ranking"
          onPress={toRankingScreen} />
        {
          showModal && 
          <CenteredModal 
            isModalVisible={showModal}
            children={"Welcome, do you want to do the tutorial? \n\n It will help you to learn how to play the game in 5 minutes. \n\n Later it is possible to do it again."} 
            onCancel={() => cancelTutorial()} 
            onPress={() => startTutorial()}
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
        icon={"book"}
        color={"white"}
        size={24}
        style={styles.tutorialButton}
        onPress={() => setIsTutorial(true)}
      />
  </>
    
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor500,
  },
  tutorialButton: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 1
  },
})
