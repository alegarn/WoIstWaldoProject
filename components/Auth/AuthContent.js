import { useState } from 'react';
import { SafeAreaView, ScrollView, Alert, StyleSheet, View, Platform, Dimensions } from 'react-native';

import { useNavigation } from '@react-navigation/native';

import Button from '../UI/Button';
import AuthForm from './AuthForm';
import { GlobalStyle } from '../../constants/theme';


const { width, height } = Dimensions.get('window');


const AuthContent = ({ isLogin, onAuthenticate }) => {

  const navigation = useNavigation();

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    confirmEmail: false,
    confirmPassword: false,
    username: false
  });

  function switchAuthModeHandler() {
    if (isLogin) {
      navigation.replace('Signup');
    };

    if (!isLogin) {
      navigation.replace('Login');
    };
  };

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
    <SafeAreaView
      style={[
        styles.authContent,
        isLogin ? { marginTop: height * 0.2 } : { marginTop: height * 0.03 }]}>
      <ScrollView>
        <AuthForm
          isLogin={isLogin}
          onSubmit={submitHandler}
          credentialsInvalid={credentialsInvalid}
          height={height}
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
};

export default AuthContent;

const styles = StyleSheet.create({
  authContent: {
    marginHorizontal: width * 0.1,
    padding: width * 0.04,
    borderRadius: width * 0.02,
    backgroundColor: GlobalStyle.color.primary800,
    elevation: 2,
    shadowColor: 'black',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: width * 0.01,
  },
  buttons: {
    marginTop: height * 0.01,
  },
});
