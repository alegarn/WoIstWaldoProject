import { View, Text, StyleSheet } from "react-native";

export default function ModalContent({ screenHeight, screenWidth, guessPath }) {
  return (
    <View 
      style={
        [styles.descriptionViewStyle, 
        { maxHeight: screenHeight*0.8, maxWidth: screenWidth*0.8 }]
        }
      >
      <Text style={styles.descriptionTitleStyle}>Is it hiding there ?</Text>
      {guessPath === false &&
        <View style={{ maxWidth: "90%" }}>
          <Text style={styles.descriptionTextStyle}>
            Your image will be sent to the server and release publicly.</Text>
          <Text style={styles.descriptionTextStyle}>
            Verify that no one is recognizable on your image.</Text>
          <Text style={styles.descriptionTextStyle}>
            Please wait for a bit that your image will be processed after confirming.</Text>
        </View>
       }
    </View>
  );
};

const styles = StyleSheet.create({
  descriptionViewStyle: {
    justifyContent: "space",
    alignItems: "center",
    overflow: "scroll",
    maxWidth: "80%",
  },
  descriptionTitleStyle: {
    fontWeight: "bold",
    fontSize: 21,
  },
  descriptionTextStyle: {
    paddingVertical: 10,
    fontSize: 19,
    textAlign: "center",
  },
});
