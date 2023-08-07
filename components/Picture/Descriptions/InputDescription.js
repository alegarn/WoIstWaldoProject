import { View, Text, TextInput, StyleSheet } from "react-native";

export default function InputDescription({label, invalid, style, textInputConfig}) {

  const inputStyles = [styles.input, invalid && styles.invalidInput];

  return(
      <View style={[styles.inputContainer, style]}>
        <Text style={[styles.label, invalid && styles.invalidLabel]}>{label}</Text>
        <TextInput {...textInputConfig} style={inputStyles}/>
      </View>
  );
};


const styles = StyleSheet.create({

  inputContainer: {
    marginHorizontal: 4,
    marginVertical: 8,
  },
  label: {
    fontSize: 24,
    color: 'white',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'transparent',
    color: 'white',
    padding: 8,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'white',
  },
  inputMultiline: {
    minHeight: 100,

    // if multiline
  },
});
