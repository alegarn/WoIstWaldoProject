import { View, Pressable, StyleSheet, ImageBackground } from 'react-native';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import MoveableTextBox from '../UI/MovableTextBox';

import { setImageDimensions } from '../../utils/imageDimensions';
export default function ShowPicture({ /* hiddenLocation, */ uri, guess, description, screenWidth, screenHeight, isPortrait,  touchLocation, handlePress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageHeight, imageWidth }) {

  // locations:
  // container: max screen
  // + picture width/height (for screen: layout)
  // choose portrait or landscape
  // expand till max size same ratio
  // corners:
    // portrait:
      // - 0, 0
    // landscape:
      // -

  const { maxHeight, maxWidth } = setImageDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });

  console.log("ShowPicture", maxHeight, maxWidth);

  const imageDimensionStyle = { width: maxWidth, height: maxHeight };


  const handleCornersLocations = (layout) => {
    const topLeftCorner = {x: layout.x, y: layout.y};
    const topRightCorner = {x: layout.x + layout.width, y: layout.y};
    const bottomLeftCorner = {x: layout.x, y: layout.y + layout.height};
    const bottomRightCorner = {x: layout.x + layout.width, y: layout.y + layout.height};
    //console.log("handleCornersLocations", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
    return {topLeftCorner: topLeftCorner, topRightCorner: topRightCorner, bottomLeftCorner: bottomLeftCorner, bottomRightCorner: bottomRightCorner}
  }


  const infoLayoutView = (event) => {
    console.log("ShowPicture infoLayoutView layout");
    //console.log("ShowPicture layout", event)
    //console.log("ShowPicture layout", event.nativeEvent.layout)
    const layout = event.nativeEvent.layout;
    const {topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner} = handleCornersLocations(layout);
    console.log("infoPressableView layout", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
  }

  const infoImageView = (event) => {
    console.log("ShowPicture infoImageView layout");
    //console.log("ShowPicture layout", event)
    //console.log("ShowPicture layout", event.nativeEvent.layout)
    const layout = event.nativeEvent.layout;

    const {topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner} = handleCornersLocations(layout);

    console.log("infoPressableView layout", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
    /*console.log("infoPressableView corners", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
 */  };

  const infoPressableView = (event) => {
    console.log("ShowPicture infoPressableView layout");
    //console.log("ShowPicture Pressable layout", event)
    //console.log("ShowPicture Pressable layout", event.nativeEvent.layout)
    const layout = event.nativeEvent.layout;
    const {topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner} = handleCornersLocations(layout);

    console.log("infoPressableView layout", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
    /*console.log("infoPressableView corners", topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner);
 */  };

  return (
    <View style={styles.container} onLayout={infoLayoutView}>
      <Pressable onPress={handlePress}  style={styles.pressable} onLayout={infoPressableView}>
        <ImageBackground
          source={{uri : uri}}
          resizeMode='stretch'
          style={[styles.image, imageDimensionStyle ]}
          onLayout={infoImageView}
          >
{/*
          {touchLocation && (
            <Text style={styles.locationText}>
              Touch Location: {touchLocation.x}, {touchLocation.y}
            </Text>
          )} */}
          {touchLocation && (
            <IconButton icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} style={target.targetStyle}/>
          )}

          { guess ? (
            <MoveableTextBox description={description} screenHeight={imageDimensionStyle.height} screenWidth={imageDimensionStyle.width}/>
          ) : null }

{/*           {hiddenLocation && (
            <IconButton icon={"close-circle-outline"} color={"white"} size={target.targetSize} style={hiddenTargetStyle}/>
          )} */}
        </ImageBackground>

    </Pressable>



      {showModal ?
        <CenteredModal onPress={handleConfirm} onCancel={onCancel} isModalVisible={showModal}>
          {"Do you want to validate this ?"}
        </CenteredModal> : null}

    </View>
  );
};

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
/*     position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, */
    justifyContent: 'center',
    alignItems: 'center',
/*     borderBlockColor: 'red',
    borderWidth: 1,
 */  },
  /* imageViewContainer: {
    flex: 1,
    borderBlockColor: 'green',
    borderWidth: 5,
  }, */
  image: {
/*     maxWidth: '100%',
    maxHeight: '100%', */
/*     borderBlockColor: 'black',
    borderWidth: 1, */
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
