import { useState, useContext } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import AuthContent from '../../components/Auth/AuthContent';
import { Credentials } from '../../components/Auth/AuthForm';

import { login } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

interface AuthUserFields {
  id?: string;
  email?: string;
  username?: string;
  finished_tutorial?: boolean;
  score_id?: string;
  is_paid?: boolean;
  paid_tier?: number;
  paid_expires_at?: string | null;
  earned_group_creator?: boolean;
  earned_premium?: boolean;
  is_group_owner?: boolean;
  active_group_id?: string | null;
}

interface AuthResponse {
  status: number;
  headers: { authorization?: string };
  data: { data: AuthUserFields };
}

interface AuthenticatePayload {
  token?: string;
  userId?: string;
  email?: string;
  username?: string;
  isTutorialFinished?: boolean;
  scoreId?: string;
  isPaid?: boolean;
  paidTier?: number;
  paidExpiresAt?: string | null;
  earnedGroupCreator?: boolean;
  earnedPremium?: boolean;
  isGroupOwner?: boolean;
  activeGroupId?: string | null;
}

type AuthContextApi = {
  authenticate: (payload: AuthenticatePayload) => Promise<void> | void;
};

function LoginScreen() {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContext = useContext(AuthContext) as AuthContextApi;

  const handleAuthDataSaving = async (response: AuthResponse, email: string): Promise<boolean> => {
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

  async function signInHandler({email, password}: Credentials): Promise<void> {
    setIsAuthenticating(true);
    try {
      const response = await login({email, password}) as AuthResponse;
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
      Alert.alert(t('auth.caughtErrorTitle'), err as string);
      setIsAuthenticating(false);
    };
  };

  return <AuthContent isLogin={true} authenticating={isAuthenticating} onAuthenticate={signInHandler} />;
};

export default LoginScreen;
