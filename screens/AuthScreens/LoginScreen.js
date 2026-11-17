import { useState, useContext } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import AuthContent from '../../components/Auth/AuthContent';

import { login } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

function LoginScreen() {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContext = useContext(AuthContext);

  const handleAuthDataSaving = async (response, email) => {
    const data = response.data.data;

    await authContext.authenticate({
      token: response.headers.authorization,
      userId: data.id,
      email: data.email ?? email,
      username: data.username ?? '',
      isTutorialFinished: data.finished_tutorial,
      scoreId: data.score_id,
      isPaid: data.is_paid,
      paidTier: data.paid_tier,
      paidExpiresAt: data.paid_expires_at,
      earnedGroupCreator: data.earned_group_creator,
      earnedPremium: data.earned_premium,
      isGroupOwner: data.is_group_owner,
      activeGroupId: data.active_group_id,
    });

    return true;
  };

  async function signInHandler({email, password}) {
    setIsAuthenticating(true);
    try {
      const response = await login({email, password});
      if (response.status === 200) {
        const authConfirmed = await handleAuthDataSaving(response, email);
        if (!authConfirmed) {
          Alert.alert(
            t('auth.serverProblemTitle'),
            t('auth.authSaveFailedMessage'));
        };
      } else if (response.status === 401) {
        Alert.alert(t('auth.invalidCredentialsTitle'), t('auth.invalidCredentialsMessage', { response }));
      } else if (response.status === 500) {
        Alert.alert(t('auth.serverErrorTitle'), t('auth.serverErrorMessage', { response }));
      } else {
        Alert.alert(t('auth.retryLaterTitle'), `${response}`);
      };
      setIsAuthenticating(false);
    } catch (err) {
      Alert.alert(t('auth.caughtErrorTitle'), err);
      setIsAuthenticating(false);
    };
  };

  return <AuthContent isLogin={true} authenticating={isAuthenticating} onAuthenticate={signInHandler} />;
};

export default LoginScreen;
