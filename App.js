import { useContext, useState, useEffect, useLayoutEffect } from 'react';

import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import { GlobalStyle } from './constants/theme';
import IconButton from './components/UI/IconButton';
import LoadingOverlay from './components/UI/LoadingOverlay';

// Auth screens
import LoginScreen from './screens/AuthScreens/LoginScreen';
import SignupScreen from './screens/AuthScreens/SignupScreen';

import HomeScreen from './screens/HomeScreen';
// Hide screens
import HidingPathScreen from './screens/HideScreens/HidingPathScreen';
import HideScreen from './screens/HideScreens/HideScreen';
// Guess screens
import GuessPathScreen from './screens/GuessScreens/GuessPathScreen';
import GuessScreen from './screens/GuessScreens/GuessScreen';
import AdScreen from './screens/GuessScreens/AdScreen';
import ResultScreen from './screens/GuessScreens/ResultScreen';

import SetInstructionsScreen from './screens/SetInstructionScreen';
import RankingScreen from './screens/RankingScreen';
import SettingsScreen from './screens/SettingsScreen';

import AuthContextProvider from './store/auth-context';
import { AuthContext } from './store/auth-context';


import 'expo-dev-client';

// AdMob
import { useInterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { getUserConsent } from './utils/adHandling';

import * as NavigationBar from "expo-navigation-bar";
import { setStatusBarHidden } from "expo-status-bar";

NavigationBar.setPositionAsync("relative");
NavigationBar.setVisibilityAsync("hidden");
NavigationBar.setBehaviorAsync("inset-swipe");
setStatusBarHidden(true, "none");


const Stack = createNativeStackNavigator();

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


function AuthenticatedStack({ authContext }) {
  /* Start loading ads */
  const { isLoaded, load } = __DEV__ ? useInterstitialAd(TestIds.INTERSTITIAL, {
    requestNonPersonalizedAdsOnly: true,
  }) : { isLoaded: false, isClosed: false, load: () => {}, show: () => {} };

  useLayoutEffect(() => {
    __DEV__ && !isLoaded ? load() : null;
  }, []);
  
  // test device id or in production
  // getUserConsent();

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
                <IconButton
                  icon="settings"
                  color={tintColor}
                  size={24}
                  onPress={() => navigation.navigate("SettingsScreen")}
                  style={{ marginRight: 20 }}
                />
                <IconButton
                  icon="exit"
                  color={tintColor}
                  size={24}
                  onPress={authContext.logout}
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
                icon="ios-arrow-back"
                color={"white"}
                size={24}
                style={{ marginRight: 20 }}
                onPress={() => navigation.goBack()} />)
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
      </Stack.Navigator>
    </>
  );
};


function Navigation({ authContext }) {
  return (
    <NavigationContainer>
      {authContext.IsAuthenticated ? <AuthenticatedStack authContext={authContext} /> : <AuthStack />}
    </NavigationContainer>
  );
};

function Root() {
  const [isTryingLogging, setIsTryingLogging] = useState(true);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    async function fetchToken() {
      const storedToken = await SecureStore.getItemAsync('token')
      if (storedToken) {
        authContext.tokenAuthentication(storedToken);
      };
      setIsTryingLogging(false);
    };
    fetchToken();

  });

  if (isTryingLogging) {
    const message = 'Logging in...';
    return <LoadingOverlay message={message} />
  };

  return <Navigation  authContext={authContext}/>

};


export default function App() {

  return (
    <>
      <StatusBar style="dark" />
      <AuthContextProvider>
        <Root />
      </AuthContextProvider>
    </>
  );
};
