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
              text="Take a Picture" 
              onPress={takePictureHandler}
              />
          : 
            <>
              <BigButton 
                text="Take a Picture" 
                onPress={takePictureHandler}
              /> 
              <BigButton text="Select an Image" onPress={pickImage} />
            </>
        } 
      </View>
      {image && (
        <View style={styles.imageContainer}>
          <Image source={{uri: image}} style={[styles.image, { width: imageWidth, height: imageHeight }]} />
        </View>
      )}
      {isTutorial && (
        <TutorialOverlay 
          screen={"HidingPathScreen"}
          instructionsPosition={{top:0, left: 0}}
          onPress={() => {console.log("next")}} />
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
