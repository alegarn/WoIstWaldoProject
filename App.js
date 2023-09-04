import { useContext, useState, useEffect } from 'react';

import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GlobalStyle } from './constants/theme';
import IconButton from './components/UI/IconButton';
import LoadingOverlay from './components/UI/LoadingOverlay';


import LoginScreen from './screens/AuthScreens/LoginScreen';
import SignupScreen from './screens/AuthScreens/SignupScreen';

import HomeScreen from './screens/HomeScreen';
import HidingPathScreen from './screens/HidingPathScreen';
import HideScreen from './screens/HideScreen';
import SetInstructionsScreen from './screens/SetInstructionScreen';
import GuessPathScreen from './screens/GuessPathScreen';
import GuessScreen from './screens/GuessScreen';
import AdScreen from './screens/AdScreen';
import ResultScreen from './screens/ResultScreen';
import RankingScreen from './screens/RankingScreen';


import AuthContextProvider from './store/auth-context';
import { AuthContext } from './store/auth-context';



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


function AuthenticatedStack() {
  const authContext = useContext(AuthContext);
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
          options={{
            presentation: "modal",
            headerShown: true,
            headerRight: ({tintColor}) => (
              <IconButton
                icon="exit"
                color={tintColor}
                size={24}
                onPress={authContext.logout}/>)
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
                onPress={() => navigation.replace("HomeScreen")} />)
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


function Navigation() {
  const authContext = useContext(AuthContext);
  return (
    <NavigationContainer>
      {authContext.IsAuthenticated ? <AuthenticatedStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

function Root() {
  const [isTryingLogging, setIsTryingLogging] = useState(true);
  const authContext = useContext(AuthContext);


  useEffect(() => {
    async function fetchToken() {
      const storedToken = await AsyncStorage.getItem('token')
      if (storedToken) {
        authContext.tokenAuthentication(storedToken);
      }
      setIsTryingLogging(false);
    };
    fetchToken();

  })

  if (isTryingLogging) {
    const message = 'Logging in...';
    return <LoadingOverlay message={message} />
  };

  return <Navigation />

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
