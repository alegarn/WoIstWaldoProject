import { useState, useContext } from 'react';
import { Alert } from 'react-native';

import LoadingOverlay from '../../components/UI/LoadingOverlay';
import AuthContent from '../../components/Auth/AuthContent';

import { login } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';
import { getScoreId } from '../../utils/auth';


function LoginScreen() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContext = useContext(AuthContext);

  const handleAuthDataSaving = async (response) => {
    authContext.authenticate({
      token: response.headers.authorization,
      expiry: response.headers.expiry,
      access_token: response.headers['access-token'],
      uid: response.headers.uid,
      client: response.headers.client,
      userId: response.data.data.id
    });
  };

  const handleScoreId = async () => {
    const scoreId = await getScoreId();
    scoreId.status === 200 && authContext.saveScoreId(scoreId.data.score_id) && console.log("scoreId saved!");
    scoreId.status !== 200 && console.log("scoreId not saved") && Alert.alert("There is a problem with the server", "Try to reconnect. You canno't get a score.");
  };

  async function signInHandler({email, password}) {
    setIsAuthenticating(true);
    try {
      const response = await login({email, password});
      console.log("response login screen", response);
      if (response.status === 200) {
        const auth = handleAuthDataSaving(response);
        const scoreId = await handleScoreId();
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
