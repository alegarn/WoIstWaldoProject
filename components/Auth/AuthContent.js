import { useState } from 'react';
import { SafeAreaView, ScrollView, Alert, StyleSheet, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../UI/Button';
import AuthForm from './AuthForm';
import { GlobalStyle } from '../../constants/theme';

function AuthContent({ isLogin, onAuthenticate }) {

  const navigation = useNavigation();

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    confirmEmail: false,
    confirmPassword: false,
    username: false
  });

  function switchAuthModeHandler() {
    // Todo
    if (isLogin) {
      navigation.replace('Signup');
    }

    if (!isLogin) {
      navigation.replace('Login');
    }
  }

  function submitHandler(credentials) {
    let { email, confirmEmail, password, confirmPassword, username } = credentials;

    email = email.trim();
    password = password.trim();
    confirmPassword = confirmPassword.trim();
    username = username.trim();

    const emailIsValid = email.includes('@') && email.includes('.');
    const passwordIsValid = password.length >= 6;
    const emailsAreEqual = email === confirmEmail;
    const passwordsAreEqual = password === confirmPassword;
    let usernameIsValid = username.length > 0;
    username ? null : usernameIsValid = true;

    if (
      !emailIsValid ||
      !passwordIsValid ||
      !usernameIsValid ||
      (!isLogin && (!emailsAreEqual || !passwordsAreEqual))
    ) {
      Alert.alert('Invalid input', 'Please check your entered credentials.');
      setCredentialsInvalid({
        email: !emailIsValid,
        confirmEmail: !emailIsValid || !emailsAreEqual,
        password: !passwordIsValid,
        confirmPassword: !passwordIsValid || !passwordsAreEqual,
        username: !usernameIsValid
      });
      return;
    };
    console.log("credentials", credentials);
    onAuthenticate({ email, password, confirmPassword, username });
  }

  return (
    <SafeAreaView style={styles.authContent}>
      <ScrollView>
        <AuthForm
          isLogin={isLogin}
          onSubmit={submitHandler}
          credentialsInvalid={credentialsInvalid}
        />
        <View style={styles.buttons}>
          <Button
            onPress={switchAuthModeHandler}
            mode={Platform.OS === "ios" ? "flat" : null}
            thin={true}
          >
            {isLogin ? 'Create a new user' : 'Log in instead'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default AuthContent;

const styles = StyleSheet.create({
  authContent: {
    marginTop: 64,
    marginHorizontal: 32,
    padding: 16,
    borderRadius: 8,
    backgroundColor: GlobalStyle.color.primary800,
    elevation: 2,
    shadowColor: 'black',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  buttons: {
    marginTop: 8,
  },
});
