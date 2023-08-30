import { useState, useContext } from 'react';
import { Alert, View } from 'react-native';

import Spinner from '../../components/UI/Spinner';
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
        console.log("token", response.headers.authorization, "expiry", response.headers.expiry, "access_token", response.headers['access-token'], "uid", response.headers.uid, "client", response.headers.client, "id", response.data.data.id);
        authContext.authenticate({ token: response.headers.authorization, expiry: response.headers.expiry, access_token: response.headers['access-token'], uid: response.headers.uid, client: response.headers.client, userId: response.data.data.id});
/*         console.log("authentification login screen", authContext.IsAuthenticated);
        console.log("header", response.headers.authorization);
        console.log('User login successful'); */

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' }}>
        <Spinner message={message} />
      </View>
    );
  };

  return <AuthContent isLogin={true} onAuthenticate={signInHandler} />;
};

export default LoginScreen;
