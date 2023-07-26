import { Text, StyleSheet, Dimensions, Pressable, Platform } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

const screenHeight = Dimensions.get('window').height;
const hideGuessButtonHeight = screenHeight * 0.35;
const rankingButtonHeight = screenHeight * 0.1;
const screenWidth = Dimensions.get('window').width;
const hideGuessButtonWidth = screenWidth * 0.75;
const rankingButtonWidth = screenWidth * 0.75;

export default function HomeScreen({ text, onPress, buttonStyle }) {
  return (
    <>
      <Pressable
        style={({ pressed }) =>
          [
            styles.HomeButton,
            pressed && styles.pressed,
            buttonStyle === 'big' ? styles.bigButton : styles.rankingButton,
            Platform.OS === 'ios' && styles.iOSButton
          ]
        }
        onPress={onPress}>
        <Text style={styles.HomeButtonText}>{text}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GlobalStyle.color.primaryColor100,
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: GlobalStyle.color.primaryColor700,
  },
  HomeButton: {
    backgroundColor: GlobalStyle.color.secondaryColor,
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  HomeButtonText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    justifyContent: 'center',
  },
  bigButton: {
    height: hideGuessButtonHeight,
    width: hideGuessButtonWidth,
  },
  rankingButton: {
    height: rankingButtonHeight,
    width: rankingButtonWidth,
  },
  iOSButton: {
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
