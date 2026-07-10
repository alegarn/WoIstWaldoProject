import { useContext, useState } from 'react';
import { Alert } from 'react-native';

import AuthContent from '../../components/Auth/AuthContent';
import { createUser } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

import LoadingOverlay from '../../components/UI/LoadingOverlay';

function SignupScreen({navigation}) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authContext = useContext(AuthContext);


  const handleAuthDataSaving = async (response) => {
    const data = response?.data?.data;

    await authContext.authenticate({
      token: response?.headers?.authorization,
      userId: data?.id,
      email: data?.email,
      username: data?.username,
      scoreId: data?.score_id,
      isTutorialFinished: data?.finished_tutorial,
      isPremium: data?.is_premium,
      premiumTier: data?.premium_tier,
      premiumExpiresAt: data?.premium_expires_at,
      isGroupOwner: data?.is_group_owner,
      activeGroupId: data?.active_group_id,
    });
  };

  async function signUpHandler({email, password, confirmPassword, username}) {
    setIsAuthenticating(true);
    try {
      const response = await createUser({email, password, confirmPassword, username});

      switch (response?.status) {
        case 200:
          await handleAuthDataSaving(response);
          break;
        case 422:
          Alert.alert('User creation failed', `${response.status}: Please choose an other email.`);
          break;
        case 500:
          Alert.alert('User creation failed', `${response.status}: Sorry, it's the server... or your username is already taken. Please retry later.`);
          break;
        default:
          Alert.alert('User creation failed', 'Please retry later.');
          break;
      };
      setIsAuthenticating(false);

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
