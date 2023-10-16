import { View, Text, StyleSheet } from "react-native";

export default function ModalContent({ screenHeight, screenWidth }) {
  return (
    <View style={[styles.descriptionViewStyle, { maxHeight: screenHeight*0.8, maxWidth: screenWidth*0.8 }]}>
      <Text style={styles.descriptionTitleStyle}>Is it hiding there ?</Text>
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
