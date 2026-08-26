import { useContext, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import AuthContent from '../../components/Auth/AuthContent';
import { createUser } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

import LoadingOverlay from '../../components/UI/LoadingOverlay';

function SignupScreen({navigation}) {
  const { t } = useTranslation();
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
      isPaid: data?.is_paid,
      paidTier: data?.paid_tier,
      paidExpiresAt: data?.paid_expires_at,
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
          Alert.alert(t('auth.userCreationFailedTitle'), t('auth.userCreationFailedEmail', { status: response.status }));
          break;
        case 500:
          Alert.alert(t('auth.userCreationFailedTitle'), t('auth.userCreationFailedServer', { status: response.status }));
          break;
        default:
          Alert.alert(t('auth.userCreationFailedTitle'), t('auth.userCreationFailedRetry'));
          break;
      };
      setIsAuthenticating(false);

    } catch (err) {
      console.log(err);
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) {
    return (
      <LoadingOverlay message={t('auth.creatingUser')} />
    );
  }

  return <AuthContent onAuthenticate={signUpHandler}/>;
}

export default SignupScreen;
