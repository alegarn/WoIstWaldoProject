import { useContext, useEffect, useRef, useState/* , useEffect, useLayoutEffect */ } from 'react';

import { AppState } from 'react-native';

import { CommonActions, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationBar } from 'expo-navigation-bar';
//import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';

import { GlobalStyle } from './constants/theme';
import IconButton from './components/UI/IconButton';
//import LoadingOverlay from './components/UI/LoadingOverlay';

// Auth screens
import LoginScreen from './screens/AuthScreens/LoginScreen';
import SignupScreen from './screens/AuthScreens/SignupScreen';

import HomeScreen from './screens/HomeScreen';
// Hide screens
import HidingPathScreen from './screens/HideScreens/HidingPathScreen';
import HideScreen from './screens/HideScreens/HideScreen';
// Guess screens
import GuessPathScreen from './screens/GuessScreens/GuessPathScreen';
import GuessFeedScreen from './screens/GuessScreens/GuessFeedScreen';
import GuessScreen from './screens/GuessScreens/GuessScreen';
import AdScreen from './screens/GuessScreens/AdScreen';
import ResultScreen from './screens/GuessScreens/ResultScreen';

import LanguageOnboardingScreen from './screens/LanguageOnboardingScreen';
import SetInstructionsScreen from './screens/SetInstructionScreen';
import RankingScreen from './screens/RankingScreen';
import SettingsScreen from './screens/SettingsScreen';

// Private group screens
import GroupsListScreen from './screens/Groups/GroupsListScreen';
import PrivateHomeScreen from './screens/Groups/PrivateHomeScreen';
import CreateGroupScreen from './screens/Groups/CreateGroupScreen';
import GroupSettingsScreen from './screens/Groups/GroupSettingsScreen';
import JoinByCodeScreen from './screens/Groups/JoinByCodeScreen';
import MemberManagementScreen from './screens/Groups/MemberManagementScreen';
import { HomeHeaderRight } from './screens/Groups/HomeHeaderRight';

// Billing screens
import PaywallScreen from './screens/Billing/PaywallScreen';
import SubscriptionManagementScreen from './screens/Billing/SubscriptionManagementScreen';

import AuthContextProvider from './store/auth-context';
import { AuthContext } from './store/auth-context';

import LoadingOverlay from './components/UI/LoadingOverlay';

import 'expo-dev-client';

const MockPreviewScreen = __DEV__ ? require('./screens/MockPreviewScreen').default : null;

// AdMob
/* import { useInterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { getUserConsent } from './utils/adHandling';
 */

import {
  bootstrapStoredAuthSession,
  getStoredAuthState,
  hasCompleteAuthState,
  isPersistedBearerToken,
  validateStoredSession,
} from './utils/auth';
import { ensureE2EOnboardingBypass, isE2EMode } from './utils/e2eMode';
import { getOnboardingCompleted } from './utils/storageDatum';


const Stack = createNativeStackNavigator();
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: GlobalStyle.color.primaryColor900,
  },
};

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: GlobalStyle.color.primaryColor700 },
        headerTintColor: 'white',
        contentStyle: { backgroundColor: GlobalStyle.color.primaryColor500 },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
};

function LanguageOnboardingStack({ onDone }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: GlobalStyle.color.primaryColor900 },
      }}
    >
      <Stack.Screen name="LanguageOnboarding">
        {() => <LanguageOnboardingScreen onDone={onDone} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}


function AuthenticatedStack({ authContext }) {
  /* Start loading ads */
/*   const { isLoaded, load } = __DEV__ ? useInterstitialAd(TestIds.INTERSTITIAL, {
    requestNonPersonalizedAdsOnly: true,
  }) : { isLoaded: false, isClosed: false, load: () => {}, show: () => {} };

  useLayoutEffect(() => {
    __DEV__ && !isLoaded ? load() : null;
  }, []); */
  
  // test device id or in production
  // getUserConsent();
  
  // useStates __________________________________________________________
  const [showOverlay, setShowOverlay] = useState(false);

  // functions __________________________________________________________
  const showLoadingOverlay = () => {
    const message = "Disconnecting...";
    return <LoadingOverlay message={message} />;
  };

  const disconnecting = async () => {
    setShowOverlay(true); // Show the overlay when logout is initiated
    // await logout({ context: authContext});
    authContext.logout();
  };

  // useEffect ___________________________________________________________
  useEffect(() => {
    if (!authContext.IsAuthenticated) {
      setShowOverlay(false); // Stop the overlay when logout is completed
    };
  }, [authContext.IsAuthenticated]);

  // && scoreId !== ""
  if (showOverlay) {
    return showLoadingOverlay();
  };

  return (
    <>
      <Stack.Navigator
        screenOptions={{
            headerStyle: { backgroundColor: GlobalStyle.color.primaryColor100 },
            headerTintColor: "white",
          }}>
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          options={({ navigation }) => ({
            presentation: "modal",
            headerShown: true,
            headerRight: ({ tintColor }) => (
              <>
                <HomeHeaderRight
                  navigation={navigation}
                  tintColor={tintColor}
                  onStartTutorial={() => navigation.setParams({ tutorialToken: Date.now() })}
                />
                <IconButton
                  accessibilityLabel="Open settings"
                  icon="settings"
                  color={tintColor}
                  size={24}
                  onPress={() => navigation.navigate("SettingsScreen")}
                  testID="home.header.settings"
                  style={{ marginRight: 20 }}
                />
                <IconButton
                  accessibilityLabel="Log out"
                  icon="exit"
                  color={tintColor}
                  size={24}
                  onPress={() => disconnecting()}
                  testID="home.header.logout"
                />
              </>
            )
          })} />
        <Stack.Screen
          name='SettingsScreen'
          component={SettingsScreen}
          options={{
            presentation: "modal",
            headerShown: true
          }} />
        <Stack.Screen
          name="HidingPathScreen"
          component={HidingPathScreen}
          options={{
            presentation: "modal",
            title:"Hide Waldo"
          }} />
        <Stack.Screen
          name="HideScreen"
          component={HideScreen}
          options={{
            presentation: "modal",
            headerShown: false,
          }} />
        <Stack.Screen
          name='SetInstructions'
          component={SetInstructionsScreen}
          options={{
            presentation: "modal",
            headerShown: false,
          }} />
        <Stack.Screen
          name="GuessPathScreen"
          component={GuessPathScreen}
          options={({ navigation }) => ({
            presentation: "modal",
            title:"Guess Path Screen",
            headerLeft: () => (
              <IconButton
                accessibilityLabel="Go back"
                icon="arrow-back"
                color={"white"}
                size={24}
                style={{ marginRight: 20 }}
                onPress={() => navigation.goBack()}
                testID="guess-path.header.back" />)
          })} />
        <Stack.Screen
          name="GuessFeedScreen"
          component={GuessFeedScreen}
          options={({ navigation }) => ({
            presentation: "modal",
            headerShown: true,
            title: "Guess Feed",
            headerLeft: () => (
              <IconButton
                accessibilityLabel="Go back"
                icon="arrow-back"
                color={"white"}
                size={24}
                style={{ marginRight: 20 }}
                onPress={() => navigation.goBack()}
                testID="guess-feed.button.back" />)
          })} />
        <Stack.Screen
          name="GuessScreen"
          component={GuessScreen}
          options={{
            presentation: "modal",
            headerShown: false,
          }} />
        <Stack.Screen
          name="AdScreen"
          component={AdScreen}
          options={{
            presentation: "modal",
            headerShown: false,
          }} />
        <Stack.Screen
          name='ResultScreen'
          component={ResultScreen}
          options={{
            presentation: "modal",
            headerShown: false,
          }} />
        <Stack.Screen
          name="RankingScreen"
          component={RankingScreen}
          options={{
            title: "Ranking",
            presentation: "modal",
            headerShown: true
          }} />
        <Stack.Screen
          name="GroupsListScreen"
          component={GroupsListScreen}
          options={{
            title: "Private Groups",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="PrivateHomeScreen"
          component={PrivateHomeScreen}
          options={{
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="CreateGroupScreen"
          component={CreateGroupScreen}
          options={{
            title: "Create Group",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="JoinByCodeScreen"
          component={JoinByCodeScreen}
          options={{
            title: "Join by Code",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="GroupSettingsScreen"
          component={GroupSettingsScreen}
          options={{
            title: "Group Settings",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="MemberManagementScreen"
          component={MemberManagementScreen}
          options={{
            title: "Members",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="PaywallScreen"
          component={PaywallScreen}
          options={{
            title: "Premium",
            presentation: "modal",
            headerShown: true,
          }} />
        <Stack.Screen
          name="SubscriptionManagementScreen"
          component={SubscriptionManagementScreen}
          options={{
            title: "Subscription",
            presentation: "modal",
            headerShown: true,
          }} />
        {__DEV__ && process.env.EXPO_PUBLIC_E2E_MODE !== 'true' && (
          <Stack.Screen
            name="MockPreview"
            component={MockPreviewScreen}
            options={{ title: "Mock Preview" }} />
        )}
      </Stack.Navigator>
    </>
  );
};


function Navigation({ authContext }) {
  const navigationRef = useNavigationContainerRef();
  const e2eHomeResetTimerRef = useRef(null);
  const [isOnboardingResolved, setIsOnboardingResolved] = useState(!authContext.IsAuthenticated);
  const [showLanguageOnboarding, setShowLanguageOnboarding] = useState(false);

  const scheduleHomeResetForE2E = () => {
    if (
      !isE2EMode() ||
      !authContext.IsAuthenticated ||
      showLanguageOnboarding ||
      !navigationRef.isReady()
    ) {
      return;
    }

    const currentRouteName = navigationRef.getCurrentRoute()?.name;

    if (!currentRouteName || currentRouteName === 'HomeScreen') {
      return;
    }

    if (e2eHomeResetTimerRef.current) {
      clearTimeout(e2eHomeResetTimerRef.current);
    }

    e2eHomeResetTimerRef.current = setTimeout(() => {
      e2eHomeResetTimerRef.current = null;

      if (!navigationRef.isReady() || navigationRef.getCurrentRoute()?.name === 'HomeScreen') {
        return;
      }

      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'HomeScreen' }],
        })
      );
    }, 2500);
  };

  useEffect(() => {
    let mounted = true;

    const syncOnboardingState = async () => {
      if (!authContext.IsAuthenticated) {
        if (!mounted) {
          return;
        }

        setShowLanguageOnboarding(false);
        setIsOnboardingResolved(true);
        return;
      }

      setIsOnboardingResolved(false);

      try {
        if (isE2EMode()) {
          await ensureE2EOnboardingBypass();

          if (!mounted) {
            return;
          }

          setShowLanguageOnboarding(false);
          return;
        }

        const onboardingCompleted = await getOnboardingCompleted();

        if (!mounted) {
          return;
        }

        setShowLanguageOnboarding(!onboardingCompleted);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setShowLanguageOnboarding(true);
      } finally {
        if (mounted) {
          setIsOnboardingResolved(true);
        }
      }
    };

    syncOnboardingState();

    return () => {
      mounted = false;
    };
  }, [authContext.IsAuthenticated]);

  useEffect(() => {
    return () => {
      if (e2eHomeResetTimerRef.current) {
        clearTimeout(e2eHomeResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (authContext.IsAuthenticated) {
      return;
    }

    if (e2eHomeResetTimerRef.current) {
      clearTimeout(e2eHomeResetTimerRef.current);
      e2eHomeResetTimerRef.current = null;
    }
  }, [authContext.IsAuthenticated]);

  useEffect(() => {
    if (!isE2EMode() || !authContext.IsAuthenticated) {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        scheduleHomeResetForE2E();
      }
    });

    return () => subscription.remove();
  }, [authContext.IsAuthenticated, showLanguageOnboarding]);

  if (!isOnboardingResolved) {
    return <LoadingOverlay message="Loading preferences..." />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={scheduleHomeResetForE2E}>
      {
        authContext.IsAuthenticated ?
          showLanguageOnboarding ?
            <LanguageOnboardingStack onDone={() => setShowLanguageOnboarding(false)} />
            :
            <AuthenticatedStack authContext={authContext} />
          :
          <AuthStack />
      }
    </NavigationContainer>
  );
};

export function Root() {
  const authContext = useContext(AuthContext);

  useEffect(() => {
    let cancelled = false;

    async function fetchStoredSession() {
      let restored = false;

      try {
        restored = await bootstrapStoredAuthSession(authContext.restoreSession);
      } catch (error) {
        console.warn('Failed to restore stored auth session', error);
      }

      if (!restored) {
        if (cancelled) {
          return;
        }

        if (
          typeof getStoredAuthState === 'function' &&
          typeof hasCompleteAuthState === 'function' &&
          typeof isPersistedBearerToken === 'function'
        ) {
          try {
            const storedAuthState = await getStoredAuthState();
            const hasStoredAuthFields = !!(storedAuthState?.token || storedAuthState?.userId);
            const hasValidStoredSession =
              hasCompleteAuthState(storedAuthState) &&
              isPersistedBearerToken(storedAuthState.token);

            if (hasStoredAuthFields && !hasValidStoredSession) {
              await authContext.logout();
            }
          } catch (error) {
            console.warn('Failed to inspect stored auth session', error);
          }
        }

        return;
      }

      if (cancelled || isE2EMode()) {
        return;
      }

      if (typeof validateStoredSession !== 'function') {
        return;
      }

      try {
        // Cheap authed call: confirms the stored token is still server-valid.
        // Only auth rejection should clear the session here. Network/server
        // failures should not force-log the user out on app launch.
        const result = await validateStoredSession({ context: authContext });

        if (cancelled) {
          return;
        }

        const status = result?.status;
        if (status === 401 || status === 403) {
          await authContext.logout();
        }
      } catch (error) {
        const status = error?.response?.status ?? error?.status;

        if (!cancelled && (status === 401 || status === 403)) {
          await authContext.logout();
        }
      }
    };

    fetchStoredSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return <Navigation  authContext={authContext}/>

};


export default function App() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(GlobalStyle.color.primaryColor900).catch(() => undefined);
  }, []);

  return (
    <AuthContextProvider>
      <NavigationBar hidden />
      <Root />
    </AuthContextProvider>
  );
};
