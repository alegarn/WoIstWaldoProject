import { StatusBar, StyleSheet } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GlobalStyle } from './constants/theme';
import IconButton from './components/UI/IconButton';

import HomeScreen from './screens/HomeScreen';
import HidingPathScreen from './screens/HidingPathScreen';
import HideScreen from './screens/HideScreen';
import SetInstructionsScreen from './screens/SetInstructionScreen';
import GuessPathScreen from './screens/GuessPathScreen';
import GuessScreen from './screens/GuessScreen';
import AdScreen from './screens/AdScreen';
import ResultScreen from './screens/ResultScreen';
import RankingScreen from './screens/RankingScreen';

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
              headerShown: false
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
      </NavigationContainer>
    </>

  );
}

const styles = StyleSheet.create({

});
