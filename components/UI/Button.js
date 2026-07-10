import { Pressable, Text, StyleSheet, View, Platform } from 'react-native';
import { GlobalStyle } from '../../constants/theme';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

export default function Button({ children, style, onPress, mode, thin, cancel, testID, accessibilityLabel, textStyle, disabled }) {
  const theme = usePrivateGroupTheme();
  const fill = theme ? theme.primaryColor : GlobalStyle.color.primaryColor100;

  return (
    <View style={[styles.button,
      { backgroundColor: fill },
      style ?? style,
      thin && { paddingVertical: 0, paddingHorizontal: 2, padding: 0 },
      mode === "flat" && { backgroundColor: "transparent" },
      cancel && mode !== "flat" && { backgroundColor: "red" }]}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={disabled ? { disabled: true } : undefined}
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => pressed && styles.pressed}
        testID={testID}
      >
        <View style={[mode === "flat" && styles.flat]}>
          <Text style={[
            styles.buttonText,
            mode === "flat" && styles.flatText,
            mode === "flat" && { color: fill },
            cancel && mode !== "flat" && styles.cancelButtonText,
            cancel && mode === "flat" && styles.flatCancelText,
            textStyle]}
            >
              {children}  
          </Text>
        </View>
      </Pressable>
    </View>

  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'transparent',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: "center",
    padding: 10
  },
  cancelButtonText: {
    color: "white",
  },
  flatCancelText: {
    color: "red"
  },
  flat: {
    backgroundColor: "transparent",
  },
  flatText: {
  },
  pressed: {
    opacity: 0.75,
    borderRadius: 4,
  }
});
