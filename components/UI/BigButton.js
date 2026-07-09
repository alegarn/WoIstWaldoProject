import { Text, StyleSheet, Dimensions, Pressable, Platform, View } from 'react-native';
import { GlobalStyle } from '../../constants/theme';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

const screenHeight = Dimensions.get('window').height;
const hideGuessButtonHeight = screenHeight * 0.35;
const rankingButtonHeight = screenHeight * 0.1;
const screenWidth = Dimensions.get('window').width;
const hideGuessButtonWidth = screenWidth * 0.75;
const rankingButtonWidth = screenWidth * 0.75;

const BigButton = (({ text, onPress, buttonStyle, testID, accessibilityLabel }) => {
  const theme = usePrivateGroupTheme();
  const fill = theme ? theme.primaryColor : GlobalStyle.color.primaryColor;
  const pressedFill = theme ? (theme.insetDeep ?? theme.primaryColor) : GlobalStyle.color.primaryColor700;
  return (
    <View>
        <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole='button'
        testID={testID}
        style={({ pressed }) =>
          [
            styles.homeButton,
            { backgroundColor: fill },
            pressed && { opacity: 0.75, backgroundColor: pressedFill },
            buttonStyle === 'big' ? styles.bigButton : styles.rankingButton,
            Platform.OS === 'ios' && styles.iOSButton
          ]
        }
        onPress={onPress}>
        <Text style={styles.homeButtonText}>{text}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  homeButton: {
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    marginVertical: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
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

export default BigButton;