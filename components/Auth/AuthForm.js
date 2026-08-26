import { useState } from 'react';
import { View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '../UI/Button';
import Input from './Input';

const AuthForm = ({ isLogin, onSubmit, credentialsInvalid, height }) => {
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
    onSubmit({
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      password: enteredPassword,
      confirmPassword: enteredConfirmPassword,
      username: enteredUsername,
    });
  }

  return (
    <View>
      <View>
        <Input
          accessibilityLabel={t('auth.emailAddress')}
          label={t('auth.emailAddress')}
          onUpdateValue={updateInputValueHandler.bind(this, 'email')}
          testID="auth.input.email"
          value={enteredEmail}
          keyboardType="email-address"
          isInvalid={emailIsInvalid}
        />
        {!isLogin && (
          <Input
            accessibilityLabel={t('auth.confirmEmailAddress')}
            label={t('auth.confirmEmailAddress')}
            onUpdateValue={updateInputValueHandler.bind(this, 'confirmEmail')}
            testID="auth.input.confirm-email"
            value={enteredConfirmEmail}
            keyboardType="email-address"
            isInvalid={emailsDontMatch}
          />
        )}
        <Input
          accessibilityLabel={t('auth.password')}
          label={t('auth.password')}
          onUpdateValue={updateInputValueHandler.bind(this, 'password')}
          secure
          testID="auth.input.password"
          value={enteredPassword}
          isInvalid={passwordIsInvalid}
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
              isInvalid={passwordsDontMatch}
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
            />
          </>
        )}
        <View style={{ marginTop: height * 0.02 }}>
          <Button
            accessibilityLabel={isLogin ? t('auth.submitLoginLabel') : t('auth.submitSignupLabel')}
            onPress={submitHandler}
            mode={Platform.OS === "ios" ? "flat" : null}
            testID={isLogin ? 'auth.button.login-submit' : 'auth.button.signup-submit'}
            thin={true}
            >
            {isLogin ? t('auth.logIn') : t('auth.signUp')}
          </Button>
        </View>
      </View>
    </View>
  );
}

export default AuthForm;
