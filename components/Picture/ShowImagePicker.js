import { View, Image, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';
import TutorialOverlay from '../UI/TutorialOverlay';
import { useRef } from 'react';

export default function ShowImagePicker({ takePictureHandler, image, imageWidth, imageHeight, pickImage }) {
  const bigButtonRef = useRef(null);
  return (
    <View style={[styles.container, { paddingTop: image ? 10 : 0, justifyContent: image ? 'flex-start' : 'center' }]}>
      <View style={[styles.buttonsContainer, {marginTop: image ? 10 : 0,}]}>
        <BigButton 
          text="Take a Picture" 
          onPress={takePictureHandler}
          ref={bigButtonRef} />
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
          targetPosition={{
            top: bigButtonRef.current.measure().pageY,
            left: bigButtonRef.current.measure().pageX
          }}
          highlightArea={{
            height: bigButtonRef.current && bigButtonRef.current.measure()?.height || 0, 
            width: bigButtonRef.current && bigButtonRef.current.measure()?.width || 0
          }} 
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
