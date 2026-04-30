import { View, Image, StyleSheet } from 'react-native';

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
  

  return (
    <View style={[styles.container, { paddingTop: image ? 10 : 0, justifyContent: image ? 'flex-start' : 'center' }]}>
      <View style={[styles.buttonsContainer, {marginTop: image ? 10 : 0,}]}>
        {isTutorial ?
            <BigButton 
              accessibilityLabel="Take a picture"
              testID="image-picker.button.take-picture"
              text="Take a Picture" 
              onPress={takePictureHandler}
              />
          : 
            <>
              <BigButton 
                accessibilityLabel="Take a picture"
                testID="image-picker.button.take-picture"
                text="Take a Picture" 
                onPress={takePictureHandler}
              /> 
              <BigButton accessibilityLabel="Select an image" testID="image-picker.button.select-image" text="Select an Image" onPress={pickImage} />
            </>
        } 
      </View>
      {image && (
        <View style={styles.imageContainer}>
          <Image accessibilityLabel="Selected image preview" source={{uri: image}} style={[styles.image, { width: imageWidth, height: imageHeight }]} testID="image-picker.preview" />
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
