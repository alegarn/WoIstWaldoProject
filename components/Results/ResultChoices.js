import { View, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { useContext } from 'react';
import { AuthContext } from '../../store/auth-context';
import Button from '../UI/Button';

export default function ResultChoices({ navigation, route, success, retryGuess, isTutorial, onNextCard }) {

  const context = useContext(AuthContext);

  const routeParams = route?.params ?? {};
  const isPrivateScope = routeParams?.scope?.kind === 'private';

  const returnHome = async () => {
    isTutorial
      && await context.updateTutorialStatus({ 
        isTutorial: true, 
        guessPathDone: true, 
        hidePathDone: context.isTutorialFinished?.hidePathDone 
      });
    
    if (isPrivateScope) {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'HomeScreen' },
          { name: 'PrivateHomeScreen', params: { scope: routeParams.scope, isTutorial } },
        ],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{
          name: 'HomeScreen',
          params: { isTutorial: isTutorial },
        }],
      });
    }
  };


  function handleRetry() {
    retryGuess();
  };

  function backToSwipe() {
    if (routeParams.category && routeParams.language) {
      onNextCard?.();
      return;
    }

    if (isPrivateScope) {
      navigation.reset({
        index: 2,
        routes: [
          { name: 'HomeScreen' },
          { name: 'PrivateHomeScreen', params: { scope: routeParams.scope } },
          { name: 'GuessPathScreen', params: { isTutorial, scope: routeParams.scope } },
        ],
      });
    } else {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'HomeScreen' },
          {
            name: 'GuessPathScreen',
            params: { isTutorial: isTutorial },
          },
        ],
      });
    }
  };

  // Visual hierarchy:
  //  - Failure: Retry is the primary (hero) action; Next Card + Home are equal-weight secondaries.
  //  - Success: Next Card is the primary action; Home stays its original small style.
  // Behaviour (onPress handlers) is unchanged.
  const isFailure = success === false;
  const nextIsPrimary = !isFailure;

  return(
    <View style={styles.buttonContainer}>
      {isFailure && (
        <Button
          accessibilityLabel="Retry this one"
          testID="result.button.retry"
          onPress={handleRetry}
          style={[styles.button, styles.primary]}
          textStyle={styles.primaryText}
        >
          Retry this one
        </Button>
      )}
      <Button
        accessibilityLabel="Next Card"
        testID="result.button.next"
        onPress={backToSwipe}
        style={[styles.button, nextIsPrimary ? styles.primary : styles.secondary]}
        textStyle={nextIsPrimary ? styles.primaryText : styles.secondaryText}
      >
        Next Card
      </Button>
      <Button
        accessibilityLabel="Home"
        testID="result.button.home"
        onPress={returnHome}
        style={[styles.button, isFailure ? styles.secondary : styles.homeButton]}
        textStyle={isFailure ? styles.secondaryText : undefined}
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
    backgroundColor: GlobalStyle.color.win,
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
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GlobalStyle.color.primaryColor,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '65%',
  },
  secondaryText: {
    color: GlobalStyle.color.primaryColor,
    fontSize: 20,
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
});
