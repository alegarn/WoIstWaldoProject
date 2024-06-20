import { View, Image, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';
import TutorialOverlay from '../UI/TutorialOverlay';

export default function ShowImagePicker({ takePictureHandler, image, imageWidth, imageHeight, pickImage }) {

  return (
    <View style={[styles.container, { paddingTop: image ? 10 : 0, justifyContent: image ? 'flex-start' : 'center' }]}>
      <View style={[styles.buttonsContainer, {marginTop: image ? 10 : 0,}]}>
        <BigButton text="Take a Picture" onPress={takePictureHandler} />
        <BigButton text="Select an Image" onPress={pickImage} />
      </View>
      {image && (
        <View style={styles.imageContainer}>
          <Image source={{uri: image}} style={[styles.image, { width: imageWidth, height: imageHeight }]} />
        </View>
      )}
      {isTutorial && (
        <TutorialOverlay 
          isVisible={true} 
          targetPosition={bigButtonRef.current && bigButtonRef.current.measure()}
          highlightArea={{height: 100, width: 100}} 
          instructions={"text"}
          instructionsPosition={{top: 50, left: 50}}
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
