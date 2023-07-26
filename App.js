import { StatusBar, StyleSheet } from 'react-native';
import { GlobalStyle } from './constants/theme';

import HomeScreen from './screens/HomeScreen';
import HideScreen from './screens/HideScreen';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


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
            title="Home"
            component={HomeScreen}
            options={{
              presentation: "modal",
            }} />
          <Stack.Screen
            name="HideScreen"
            title="Hide Waldo"
            component={HideScreen}
            options={{
              presentation: "modal",
            }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>

  );
}

const styles = StyleSheet.create({

});
