import { View, Image, StyleSheet } from 'react-native';

import BigButton from '../UI/BigButton';
import TutorialOverlay from '../UI/TutorialOverlay';
import { useEffect, useState } from 'react';

export default function ShowImagePicker(
  { takePictureHandler, 
    image, 
    imageWidth, 
    imageHeight, 
    pickImage, 
    isTutorial 
  }) {
  
  const [layoutValues, setLayoutValues] = useState({x: 0, y: 0, width: 0, height: 0});

  useEffect(() => {
    console.log("useEffect layoutValues", layoutValues);
    //   LOG  layoutValues null
    if (isTutorial && layoutValues != null) {
      const {x, y, width, height} = layoutValues;
      console.log("useEffect onLayout", x, y, width, height);
    }

  }, [layoutValues]);

  return (
    <View style={[styles.container, { paddingTop: image ? 10 : 0, justifyContent: image ? 'flex-start' : 'center' }]}>
      <View style={[styles.buttonsContainer, {marginTop: image ? 10 : 0,}]}>
        {isTutorial ?
          (
            <View
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setLayoutValues({ x, y, width, height });
                console.log("View onLayout", x, y, width, height);
              }} 
              >
              <BigButton 
                text="Take a Picture" 
                onPress={takePictureHandler}
                style={{ width: 200, height: 50 }} // Temporarily set a fixed size
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  console.log("onLayout BigButton", x, y, width, height);
                }}
                />
            </View>
          )
          : 
          <BigButton 
            text="Take a Picture" 
            onPress={takePictureHandler}
           /> 
        } 
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
          targetPosition={ layoutValues ?? {top: layoutValues?.y, left: layoutValues?.x}}
          highlightArea={ layoutValues ?? {width: layoutValues?.width, height: layoutValues?.height}} 
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
