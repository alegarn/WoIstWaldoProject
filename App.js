import { StatusBar, StyleSheet } from 'react-native';
import { GlobalStyle } from './constants/theme';

import HomeScreen from './screens/HomeScreen';
import HidingPathScreen from './screens/HidingPathScreen';
import HideScreen from './screens/HideScreen';
import SetInstructionsScreen from './screens/SetInstructionScreen';
import GuessPathScreen from './screens/GuessPathScreen';
import GuessScreen from './screens/GuessScreen';
import AdScreen from './screens/AdScreen';


import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ResultScreen from './screens/ResultScreen';


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
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
              title:"Home"
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
            options={{
              presentation: "modal",
              title:"Guess Path Screen"
            }} />
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
        </Stack.Navigator>
      </NavigationContainer>
    </>

  );
}

const styles = StyleSheet.create({

});
