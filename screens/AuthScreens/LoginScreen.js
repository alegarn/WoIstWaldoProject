import { useState, useContext } from 'react';
import { Alert } from 'react-native';

import LoadingOverlay from '../../components/UI/LoadingOverlay';
import AuthContent from '../../components/Auth/AuthContent';

import { login } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';


function LoginScreen() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContext = useContext(AuthContext);

  async function signInHandler({email, password}) {
    setIsAuthenticating(true);
    try {
      const response = await login({email, password});
      console.log("response login screen", response);
      if (response.status === 200) {
        authContext.authenticate({
          token: response.headers.authorization,
          expiry: response.headers.expiry,
          access_token: response.headers['access-token'],
          uid: response.headers.uid,
          client: response.headers.client,
          userId: response.data.data.id
        });
      } else {
          console.log(response);
          Alert.alert('Invalid input', `${response}`);
          setIsAuthenticating(false);
        };
    } catch (err) {
      console.log(err);
      Alert.alert('There is an error', err);
      setIsAuthenticating(false);
    };
  };

  if (isAuthenticating) {
    const message = 'Authenticating...';
    return (
      <LoadingOverlay message={message} />
    );
  };

  return <AuthContent isLogin={true} onAuthenticate={signInHandler} />;
};

export default LoginScreen;
