import { View, Text, Pressable, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { useContext } from 'react';
import { AuthContext } from '../../store/auth-context';
import Button from '../UI/Button';

export default function ResultChoices({ navigation, route, success, retryGuess, isTutorial }) {

  const context = useContext(AuthContext);

  const routeParams = route?.params ?? {};

  const returnHome = async () => {
    isTutorial
      && await context.updateTutorialStatus({ 
        isTutorial: true, 
        guessPathDone: true, 
        hidePathDone: context.isTutorialFinished?.hidePathDone 
      });
    
    navigation.reset({
      index: 0,
      routes: [{ 
        name: 'HomeScreen', 
        params: { isTutorial: isTutorial } 
      }],
    });
  };


  function handleRetry() {
    retryGuess();
  };

  function backToSwipe() {
    if (routeParams.category && routeParams.language) {
      navigation.reset({
        index: 3,
        routes: [
          { name: 'HomeScreen' },
          { name: 'GuessPathScreen', params: { isTutorial } },
          { name: 'GuessFeedScreen', params: { category: routeParams.category, language: routeParams.language } },
          { name: 'ResultScreen' },
        ],
      });
      return;
    }

    navigation.reset({
      index: 1,
      routes: [{ 
        name: 'GuessPathScreen', 
        params: { isTutorial: isTutorial } 
      }],
    });
  };

  return(
    <View style={styles.buttonContainer}>
      {success === false && (
        <Pressable
          accessibilityLabel="Retry this one"
          accessibilityRole="button"
          testID="result.button.retry"
          onPress={handleRetry}
          style={({ pressed }) => [
            styles.button,
            styles.secondary,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>Retry this one</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityLabel="Next Card"
        accessibilityRole="button"
        testID="result.button.next"
        onPress={backToSwipe}
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryText}>Next Card</Text>
      </Pressable>
      <Button
        accessibilityLabel="Home"
        testID="result.button.home"
        onPress={returnHome}
        style={[styles.button, styles.homeButton]}
      >
        Home
      </Button>
    </View>
  );
};


const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  primary: {
    backgroundColor: '#FFD700',
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '90%',
  },
  primaryText: {
    color: GlobalStyle.color.tertiaryColor900,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  homeButton: {
    backgroundColor: GlobalStyle.color.primaryColor100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '50%',
    borderWidth: 1,
    borderColor: GlobalStyle.color.primaryColor900,
  },
  secondaryText: {
    color: GlobalStyle.color.tertiaryColor900,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
