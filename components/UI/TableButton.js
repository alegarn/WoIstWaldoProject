import { Pressable, Text, View , StyleSheet} from "react-native";
import { GlobalStyle } from "../../constants/theme";

  export default function TableButton({ onPress, buttonWidth, buttonHeight, buttonBorderRadius, testID, accessibilityLabel }) {
    return(
      <View style={[styles.btn, { width: buttonWidth, height: buttonHeight, borderRadius: buttonBorderRadius }]}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          testID={testID}
          style={ ({pressed}) => pressed && styles.pressed}>
            <Text style={styles.btnText}>More</Text>
        </Pressable>
      </View>
    );
  };

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  btn: {
    backgroundColor: GlobalStyle.color.primaryColor,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: 'rgba(160, 118, 249, 0.5)',
    justifyContent: 'center',
  },
  btnText: {
    textAlign: 'center',
    color: "white",
    fontWeight: '600',
    fontSize: 11,
  },
});
