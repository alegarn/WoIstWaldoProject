import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useTranslation } from 'react-i18next';

export default function ModalContent({ screenHeight, screenWidth, guessPath }) {
  const { t } = useTranslation();
  const bodyMaxHeight = Math.min(screenHeight * 0.45, 260);

  return (
    <View
      style={[styles.descriptionViewStyle, { maxWidth: screenWidth * 0.8 }]}
    >
      <Text style={styles.descriptionTitleStyle}>{t('ui.uploadNotice.title')}</Text>
      {guessPath === false &&
        <ScrollView
          style={[styles.descriptionBodyScrollStyle, { maxHeight: bodyMaxHeight }]}
          contentContainerStyle={styles.descriptionTextContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.descriptionTextStyle}>
            {t('ui.uploadNotice.publicRelease')}</Text>
          <Text style={styles.descriptionTextStyle}>
            {t('ui.uploadNotice.noRecognizablePerson')}</Text>
          <Text style={styles.descriptionTextStyle}>
            {t('ui.uploadNotice.processingDelay')}</Text>
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
