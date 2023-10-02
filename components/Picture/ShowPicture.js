import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import ModalContent from '../UI/ModalContent';

// pictureUri only in dev with local images
export default function ShowPicture({ /* hiddenLocation, */ uri, guess, description, screenWidth, screenHeight, isPortrait,  touchLocation, handlePress, target, handleIconPress, showModal, handleConfirm,  onCancel }) {

  const imageDimensionStyle = { width: screenWidth, height: screenHeight }

  // only in dev with local images
/*   const uriPict = uri ? { uri: uri } : pictureUri;
 */  //


  /*  */
/*
  function handletargetSize(screenWidth, screenHeight) {
    const targetSize = Math.min(screenWidth, screenHeight) * 0.1;
    return targetSize;
  };

  const targetSize = handletargetSize(screenWidth, screenHeight);

  const hiddenTargetStyle = {
    position: 'absolute',
    width: targetSize,
    height: targetSize,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "white",
    borderRadius: 0,

    left: hiddenLocation ? (hiddenLocation.x * screenWidth - targetSize / 2) : null,
    top: hiddenLocation ? (hiddenLocation.y * screenHeight - targetSize / 2): null,
  }; */

  /*  */

  const modalContent = guess ? (
    <ModalContent
      description={description}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      guessPath={true}
    />
    )
    :
    "Is it hiding there ?";

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <ImageBackground
          source={{uri : uri}}
          resizeMode='stretch'
          style={[styles.image, imageDimensionStyle ]}>
{/*
          {touchLocation && (
            <Text style={styles.locationText}>
              Touch Location: {touchLocation.x}, {touchLocation.y}
            </Text>
          )} */}
          {touchLocation && (
            <IconButton icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} style={target.targetStyle}/>
          )}

{/*           {hiddenLocation && (
            <IconButton icon={"close-circle-outline"} color={"white"} size={target.targetSize} style={hiddenTargetStyle}/>
          )} */}
        </ImageBackground>
      </Pressable>

      {showModal ?
        <CenteredModal onPress={handleConfirm} onCancel={onCancel} isModalVisible={showModal}>
          {modalContent}
        </CenteredModal> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  locationText: {
    position: 'absolute',
    bottom: 90,
    left: 50,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
  },
  target: {
    borderColor: 'white',
  },
  descriptionViewStyle: {
    justifyContent: "space",
    alignItems: "center",
    overflow: "scroll",
  },
  descriptionTitleStyle: {
    fontWeight: "bold",
  },
  descriptionTextStyle: {
    padding: 10
  }
});
