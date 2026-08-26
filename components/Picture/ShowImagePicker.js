import { View, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import BigButton from '../UI/BigButton';
import TutorialOverlay from '../UI/TutorialOverlay';

export default function ShowImagePicker(
  { takePictureHandler,
    image,
    imageWidth,
    imageHeight,
    pickImage,
    isTutorial
  }) {
  const { t } = useTranslation();


  return (
    <View style={[styles.container, { paddingTop: image ? 10 : 0, justifyContent: image ? 'flex-start' : 'center' }]}>
      <View style={[styles.buttonsContainer, {marginTop: image ? 10 : 0,}]}>
        {isTutorial ?
            <BigButton
              accessibilityLabel={t('hide.takePictureLabel')}
              testID="image-picker.button.take-picture"
              text={t('hide.takePicture')}
              onPress={takePictureHandler}
              />
          :
            <>
              <BigButton
                accessibilityLabel={t('hide.takePictureLabel')}
                testID="image-picker.button.take-picture"
                text={t('hide.takePicture')}
                onPress={takePictureHandler}
              />
              <BigButton accessibilityLabel={t('hide.selectImageLabel')} testID="image-picker.button.select-image" text={t('hide.selectImage')} onPress={pickImage} />
            </>
        }
      </View>
      {image && (
        <View style={styles.imageContainer}>
          <Image accessibilityLabel={t('hide.previewLabel')} source={{uri: image}} style={[styles.image, { width: imageWidth, height: imageHeight }]} testID="image-picker.preview" />
        </View>
      )}
      {isTutorial && (
        <TutorialOverlay 
          screen={"HidingPathScreen"}
          instructionsPosition={{top:0, left: 0}}
         />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
  },
});
