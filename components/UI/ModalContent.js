import { View, Text, StyleSheet } from "react-native";

export default function ModalContent({ description, screenHeight, screenWidth, guessPath }) {
  return (
    <View style={[styles.descriptionViewStyle, { maxHeight: screenHeight*0.8, maxWidth: screenWidth*0.8 }]}>

      { guessPath ?
        <Text style={styles.descriptionTitleStyle}>Description: </Text> :
        <Text style={[styles.descriptionTitleStyle, { fontSize: 16, width: screenWidth*0.7 }]}>Do you want to send your image with this description ? </Text>}

      <Text style={[styles.descriptionTextStyle, { width: screenWidth*0.7 }]}>{description}</Text>

      { guessPath && <Text style={styles.descriptionTitleStyle}>Is it hiding there ?</Text> }

    </View>
  );
};

const styles = StyleSheet.create({
  descriptionViewStyle: {
    justifyContent: "space",
    alignItems: "center",
    overflow: "scroll",
  },
  descriptionTitleStyle: {
    fontWeight: "bold",
  },
  descriptionTextStyle: {
    paddingVertical: 10
  },
});
