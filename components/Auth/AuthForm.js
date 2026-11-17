import { useState } from 'react';
import { View, Platform, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import Input from './Input';
import { GlobalStyle, spacing, radius, typography, touchTarget } from '../../constants/theme';

const AuthForm = ({ isLogin, onSubmit, credentialsInvalid, authenticating }) => {
  const { t } = useTranslation();
  const [enteredEmail, setEnteredEmail] = useState('');
  const [enteredConfirmEmail, setEnteredConfirmEmail] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [enteredConfirmPassword, setEnteredConfirmPassword] = useState('');
  const [enteredUsername, setEnteredUsername] = useState('');

  const {
    email: emailIsInvalid,
    confirmEmail: emailsDontMatch,
    password: passwordIsInvalid,
    confirmPassword: passwordsDontMatch,
    username: usernameIsInvalid,
  } = credentialsInvalid;

  function updateInputValueHandler(inputType, enteredValue) {
    switch (inputType) {
      case 'email':
        setEnteredEmail(enteredValue);
        break;
      case 'confirmEmail':
        setEnteredConfirmEmail(enteredValue);
        break;
      case 'password':
        setEnteredPassword(enteredValue);
        break;
      case 'confirmPassword':
        setEnteredConfirmPassword(enteredValue);
        break;
      case 'username':
        setEnteredUsername(enteredValue);
        break;
    }
  }

  function submitHandler() {
    if (authenticating) {
      return;
    }
    onSubmit({
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      password: enteredPassword,
      confirmPassword: enteredConfirmPassword,
      username: enteredUsername,
    });
  }

  const loadingText = isLogin ? t('auth.authenticating') : t('auth.creatingUser');

  return (
    <View>
      <Input
        accessibilityLabel={t('auth.emailAddress')}
        label={t('auth.emailAddress')}
        onUpdateValue={updateInputValueHandler.bind(this, 'email')}
        testID="auth.input.email"
        value={enteredEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        isInvalid={emailIsInvalid}
        error={t('auth.errorEmail')}
      />
      {!isLogin && (
        <Input
          accessibilityLabel={t('auth.confirmEmailAddress')}
          label={t('auth.confirmEmailAddress')}
          onUpdateValue={updateInputValueHandler.bind(this, 'confirmEmail')}
          testID="auth.input.confirm-email"
          value={enteredConfirmEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          isInvalid={emailsDontMatch}
          error={t('auth.errorConfirmEmail')}
        />
      )}
      <Input
        accessibilityLabel={t('auth.password')}
        label={t('auth.password')}
        onUpdateValue={updateInputValueHandler.bind(this, 'password')}
        secure
        testID="auth.input.password"
        value={enteredPassword}
        textContentType={isLogin ? 'password' : 'newPassword'}
        autoComplete={isLogin ? 'password' : 'new-password'}
        isInvalid={passwordIsInvalid}
        error={t('auth.errorPassword')}
      />
      {!isLogin && (
        <>
          <Input
            accessibilityLabel={t('auth.confirmPassword')}
            label={t('auth.confirmPassword')}
            onUpdateValue={updateInputValueHandler.bind(
              this,
              'confirmPassword'
            )}
            secure
            testID="auth.input.confirm-password"
            value={enteredConfirmPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            isInvalid={passwordsDontMatch}
            error={t('auth.errorConfirmPassword')}
          />
          <Input
            accessibilityLabel={t('auth.username')}
            label={t('auth.username')}
            onUpdateValue={updateInputValueHandler.bind(
              this,
              'username'
            )}
            testID="auth.input.username"
            value={enteredUsername}
            textContentType="username"
            autoComplete="username"
            isInvalid={usernameIsInvalid}
            error={t('auth.errorUsername')}
          />
        </>
      )}
      <Pressable
        accessibilityLabel={isLogin ? t('auth.submitLoginLabel') : t('auth.submitSignupLabel')}
        accessibilityRole="button"
        accessibilityState={authenticating ? { disabled: true, busy: true } : undefined}
        onPress={submitHandler}
        disabled={authenticating}
        style={({ pressed }) => [
          styles.submitButton,
          authenticating && styles.submitButtonLoading,
          pressed && !authenticating && styles.submitButtonPressed,
        ]}
        testID={isLogin ? 'auth.button.login-submit' : 'auth.button.signup-submit'}
      >
        {authenticating ? (
          <>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.submitButtonText}>{loadingText}</Text>
          </>
        ) : (
          <Text style={styles.submitButtonText}>
            {isLogin ? t('auth.logIn') : t('auth.signUp')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.minHeight,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: GlobalStyle.color.primaryColor100,
  },
  submitButtonPressed: {
    opacity: 0.8,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default AuthForm;
