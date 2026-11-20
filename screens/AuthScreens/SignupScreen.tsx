import { useContext, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import AuthContent from '../../components/Auth/AuthContent';
import { Credentials } from '../../components/Auth/AuthForm';
import { createUser } from '../../utils/auth';
import { AuthContext } from '../../store/auth-context';

interface AuthUserFields {
  id?: string;
  email?: string;
  username?: string;
  score_id?: string;
  finished_tutorial?: boolean;
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
  scoreId?: string;
  isTutorialFinished?: boolean;
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

interface SignupScreenProps {
  navigation: {
    replace: (screen: string) => void;
  };
}

function SignupScreen({navigation}: SignupScreenProps) {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authContext = useContext(AuthContext) as AuthContextApi;


  const handleAuthDataSaving = async (response: AuthResponse): Promise<void> => {
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
      earnedGroupCreator: data?.earned_group_creator,
      earnedPremium: data?.earned_premium,
      isGroupOwner: data?.is_group_owner,
      activeGroupId: data?.active_group_id,
    });
  };

  async function signUpHandler({email, password, confirmPassword, username}: Credentials): Promise<void> {
    setIsAuthenticating(true);
    try {
      const response = await createUser({email, password, confirmPassword, username}) as AuthResponse;

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
      Alert.alert(
        t('auth.userCreationFailedTitle'),
        t('auth.userCreationFailedRetry'));
      setIsAuthenticating(false);
    }
  };

  return <AuthContent isLogin={false} authenticating={isAuthenticating} onAuthenticate={signUpHandler}/>;
}

export default SignupScreen;
