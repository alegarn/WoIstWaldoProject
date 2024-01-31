import { Pressable, Text, StyleSheet, View, Platform } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

export default function Button({ children, style, onPress, mode, thin, cancel }) {


  return (
    <View style={[styles.button,
      style ?? style,
      thin && { paddingVertical: 0, paddingHorizontal: 2, padding: 0 },
      mode === "flat" && { backgroundColor: "transparent" },
      cancel && mode !== "flat" && { backgroundColor: "red" }]}
    >
      <Pressable onPress={onPress} style={({pressed}) => pressed && styles.pressed} >
        <View style={[mode === "flat" && styles.flat]}>
          <Text style={[
            styles.buttonText,
            mode === "flat" && styles.flatText,
            cancel && mode !== "flat" && styles.cancelButtonText,
            cancel && mode === "flat" && styles.flatCancelText]}
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
    backgroundColor: GlobalStyle.color.primaryColor100,
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
    color: GlobalStyle.color.primaryColor100,
  },
  pressed: {
    opacity: 0.75,
    borderRadius: 4,
  }
});
