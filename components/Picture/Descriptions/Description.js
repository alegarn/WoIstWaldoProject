import { useState } from "react";
import { View, StyleSheet } from "react-native";

import InputDescription from "./InputDescription";
import Button from "../../UI/Button";
export default function Description({onCancel}) {

  const [descriptionText, setDescriptionText] = useState("");

  function inputChangeHandler(enteredValue) {
    setDescriptionText((currentInput) =>{
      return {
        ...currentInput,
        enteredValue
      }
    });
  };

  function submitHandler() {
    console.log(descriptionText);
  };

  return (
    <View style={styles.container}>
      <View style={styles.descritionContainer}>
        <InputDescription
          label="Describe the location"
          invalid={false}
          style={styles.input}
          textInputConfig={{
            placeholder: "How is your hiding location?",
            placeholderTextColor: "white",
            keyboardType: "default",
            onChangeText: inputChangeHandler,
            maxLength: 800,
            multiline: true }}/>
        <View style={styles.buttonContainer}>
          <Button style={styles.button} thin={true} onPress={submitHandler}>Confirm ?</Button>
          <Button style={styles.button} thin={true} onPress={onCancel}>Cancel</Button>
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
