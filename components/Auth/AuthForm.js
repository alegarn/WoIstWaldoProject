import { useState } from 'react';
import { View, Platform } from 'react-native';

import Button from '../UI/Button';
import Input from './Input';

const AuthForm = ({ isLogin, onSubmit, credentialsInvalid, height }) => {
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
          label="Email Address"
          onUpdateValue={updateInputValueHandler.bind(this, 'email')}
          value={enteredEmail}
          keyboardType="email-address"
          isInvalid={emailIsInvalid}
        />
        {!isLogin && (
          <Input
            label="Confirm Email Address"
            onUpdateValue={updateInputValueHandler.bind(this, 'confirmEmail')}
            value={enteredConfirmEmail}
            keyboardType="email-address"
            isInvalid={emailsDontMatch}
          />
        )}
        <Input
          label="Password"
          onUpdateValue={updateInputValueHandler.bind(this, 'password')}
          secure
          value={enteredPassword}
          isInvalid={passwordIsInvalid}
        />
        {!isLogin && (
          <>
            <Input
              label="Confirm Password"
              onUpdateValue={updateInputValueHandler.bind(
                this,
                'confirmPassword'
              )}
              secure
              value={enteredConfirmPassword}
              isInvalid={passwordsDontMatch}
            />
            <Input
              label="Username"
              onUpdateValue={updateInputValueHandler.bind(
                this,
                'username'
              )}
              value={enteredUsername}
            />
          </>
        )}
        <View style={{ marginTop: height * 0.02 }}>
          <Button
            onPress={submitHandler}
            mode={Platform.OS === "ios" ? "flat" : null}
            thin={true}
            >
            {isLogin ? 'Log In' : 'Sign Up'}
          </Button>
        </View>
      </View>
    </View>
  );
}

export default AuthForm;
