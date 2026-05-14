import { View, StyleSheet } from "react-native";
import Button from "../../UI/Button";
import InputDescription from "./InputDescription";


export default function ShowHideDescription({ inputChangeHandler, submitHandler, onCancel }) {
  return (
    <View style={styles.container}>
      <View style={styles.descritionContainer}>
        <InputDescription
          label="Describe the hidden point"
          invalid={false}
          style={styles.input}
          textInputConfig={{
            accessibilityLabel: "Hidden point description",
            placeholder: "How is your hiding location?",
            placeholderTextColor: "white",
            keyboardType: "default",
            onChangeText: inputChangeHandler,
            maxLength: 800,
            multiline: true,
            testID: 'set-instructions.input.description' }}/>
        <View style={styles.buttonContainer}>
          <Button accessibilityLabel="Confirm hidden point description" style={styles.button} thin={true} onPress={submitHandler} testID="set-instructions.button.confirm-description">Confirm ?</Button>
          <Button accessibilityLabel="Cancel hidden point description" style={styles.button} thin={true} onPress={onCancel} testID="set-instructions.button.cancel-description">Cancel</Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, // part screen, none
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    opacity: 0.75
  },
  descritionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "80%",
    maxHeight: "80%",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  button: {
    borderRadius: 10,
    marginHorizontal: 10,
  }
})
