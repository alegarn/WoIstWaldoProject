import { ScrollView, View, Text, StyleSheet } from "react-native";

export default function ModalContent({ screenHeight, screenWidth, guessPath }) {
  const bodyMaxHeight = Math.min(screenHeight * 0.45, 260);

  return (
    <View
      style={[styles.descriptionViewStyle, { maxWidth: screenWidth * 0.8 }]}
    >
      <Text style={styles.descriptionTitleStyle}>Is it hiding there ?</Text>
      {guessPath === false &&
        <ScrollView
          style={[styles.descriptionBodyScrollStyle, { maxHeight: bodyMaxHeight }]}
          contentContainerStyle={styles.descriptionTextContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.descriptionTextStyle}>
            Your image will be sent to the server and release publicly.</Text>
          <Text style={styles.descriptionTextStyle}>
            Verify that no one is recognizable on your image.</Text>
          <Text style={styles.descriptionTextStyle}>
            Please wait for a bit that your image will be processed after confirming.</Text>
        </ScrollView>
       }
    </View>
  );
};

const styles = StyleSheet.create({
  descriptionViewStyle: {
    alignItems: "center",
    width: "100%",
  },
  descriptionTitleStyle: {
    fontWeight: "bold",
    fontSize: 21,
    textAlign: "center",
    marginBottom: 12,
  },
  descriptionBodyScrollStyle: {
    width: "100%",
    flexGrow: 0,
  },
  descriptionTextContainer: {
    width: "100%",
    alignItems: "center",
  },
  descriptionTextStyle: {
    paddingVertical: 10,
    fontSize: 19,
    textAlign: "center",
  },
});
