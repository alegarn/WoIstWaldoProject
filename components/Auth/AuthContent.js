import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  View,
  Text,
  Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '../UI/Button';
import AuthForm from './AuthForm';
import { GlobalStyle, spacing, radius, typography, shadow } from '../../constants/theme';

const AuthContent = ({ isLogin, onAuthenticate, authenticating }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();

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
      setCredentialsInvalid({
        email: !emailIsValid,
        confirmEmail: !emailIsValid || !emailsAreEqual,
        password: !passwordIsValid,
        confirmPassword: !passwordIsValid || !passwordsAreEqual,
        username: !usernameIsValid
      });
      return;
    };
    onAuthenticate({ email, password, confirmPassword, username });
  }

  return (
    <SafeAreaView
      style={[
        styles.authContent,
        isLogin ? styles.authContentLogin : styles.authContentSignup,
      ]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
            </Text>
          </View>
          <View style={[styles.card, shadow.card]}>
            <AuthForm
              isLogin={isLogin}
              onSubmit={submitHandler}
              credentialsInvalid={credentialsInvalid}
              authenticating={authenticating}
            />
            <View style={styles.buttons}>
              <Button
                accessibilityLabel={isLogin ? t('auth.switchToSignupLabel') : t('auth.switchToLoginLabel')}
                onPress={switchAuthModeHandler}
                disabled={authenticating}
                mode={Platform.OS === "ios" ? "flat" : null}
                testID={isLogin ? 'auth.button.switch-to-signup' : 'auth.button.switch-to-login'}
                thin={true}
              >
                {isLogin ? t('auth.createAccount') : t('auth.loginInstead')}
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthContent;

const styles = StyleSheet.create({
  authContent: {
    flex: 1,
  },
  authContentLogin: {
    marginTop: spacing.xl,
  },
  authContentSignup: {
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: 'white',
  },
  subtitle: {
    ...typography.subtitle,
    color: GlobalStyle.color.secondaryColor100,
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: GlobalStyle.color.primaryColor800,
  },
  buttons: {
    marginTop: spacing.md,
  },
});
