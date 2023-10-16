import { useContext, useState } from 'react';
import { Alert } from 'react-native';

import AuthContent from '../../components/Auth/AuthContent';
import { createUser, login } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

import LoadingOverlay from '../../components/UI/LoadingOverlay';

function SignupScreen({navigation}) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authContext = useContext(AuthContext);

  async function signUpHandler({email, password, confirmPassword, username}) {
    setIsAuthenticating(true);
    try {

      const {response, status, token, expiry, access_token} = await createUser({email, password, confirmPassword, username});

      console.log("response", response);

      setIsAuthenticating(false);

      switch (status) {
        case 200:
          const authentification = await login({email, password});
          console.log("authentication", authentification);

          if (authentification.status === 200) {
            console.log("Authentication successful");
            authContext.authenticate({
              token: authentification.headers.authorization,
              expiry: authentification.headers.expiry,
              access_token: authentification.headers['access-token'],
              uid: authentification.headers.uid,
              client: authentification.headers.client,
              userId: authentification.data.data.id
            });
          };
          break;
        case 422:
          Alert.alert('User creation failed', `${status}: Please choose an other email.`);
          break;
        case 500:
          Alert.alert('User creation failed', `${status}: Sorry, it's the server... or your username is already taken. Please retry later.`);
          break;
        default:
          Alert.alert('User creation failed', 'Please retry later.');
          break;
      };

    } catch (err) {
      console.log(err);
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) {
    const message = 'Creating user...';
    return (
      <LoadingOverlay message={message} />
    );
  }

  return <AuthContent onAuthenticate={signUpHandler}/>;
}

export default SignupScreen;
