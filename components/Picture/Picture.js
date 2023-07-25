import  { useState, useLayoutEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, Dimensions, Modal, Button } from 'react-native';
import { handleImageOrientation } from "../../utils/orientation";
import { handleImageSize } from "../../utils/imageSize";

import IconButton from '../UI/IconButton';
import { Ionicons } from '@expo/vector-icons';
import CenteredModal from '../UI/CenteredModal';

export default function Picture({  uri, isPortrait, imageWidth, imageHeight, screenHeight, screenWidth }) {
  console.log("screenWidth: ", screenWidth);
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, circleSize: 0 });

  const [showModal, setShowModal] = useState(false);


  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    handleImageOrientation({ imageIsPortrait, isPortrait });
    handleImageSize({ screenWidth, screenHeight, imageWidth, imageHeight });

  }, []);

  const handlePress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const newImageWidth = screenWidth;
    const newImageHeight = screenHeight;
    // Check if the touch event is within the image boundaries
    if (
      locationX >= 0 &&
      locationX <= newImageWidth &&
      locationY >= 0 &&
      locationY <= newImageHeight
    ) {
      console.log("locationX: ", locationX);
      console.log("locationY: ", locationY);

      const touchX = (locationX / newImageWidth).toFixed(2);
      const touchY = (locationY / newImageHeight).toFixed(2);
      setTouchLocation({ x: touchX, y: touchY });

      const circleSize = Math.min(screenWidth, screenHeight) * 0.1;
      const circleStyle = {
        position: 'absolute',
        width: circleSize,
        height: circleSize,
        borderRadius: circleSize / 2,
        left: locationX - circleSize / 2,
        top: locationY - circleSize / 2,
      };

      // Render the white circle
      setTouchLocation({ x: touchX, y: touchY, circleSize: circleSize, circleStyle: circleStyle });
    }
  };

  const handleIconPress = () => {
    setShowModal(true);
  };

  const onCancel = () => {
    setShowModal(false);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <ImageBackground source={{ uri: uri }} style={[styles.image, { width: screenWidth, height: screenHeight }]}>
          {touchLocation && (
            <Text style={styles.locationText}>
              Touch Location: {touchLocation.x}, {touchLocation.y}
            </Text>
          )}
          {touchLocation && (
            <Pressable onPress={handleIconPress}>
              <Ionicons name={"close-circle-outline"} color={"white"} size={touchLocation.circleSize} style={touchLocation.circleStyle}/>
            </Pressable>
          )}
        </ImageBackground>
      </Pressable>

      {showModal ?
        <CenteredModal onPress={handleIconPress} onCancel={onCancel} isModalVisible={showModal}>
          Is it hiding there ?
        </CenteredModal> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    flex: 1,
  },
  pressable: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 10,
    marginBottom: 20,
  },
  image: {
    resizeMode: 'contain',
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
  circle: {
    borderWidth: 1,
    borderColor: 'white',
  },
});


/*   const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
 */

/*   useEffect(() => {
    const updateScreenDimensions = () => {
      setScreenDimensions(Dimensions.get('window'));
    };

    Dimensions.addEventListener('change', updateScreenDimensions);

    return () => {
      Dimensions.removeEventListener('change', updateScreenDimensions);
    };
  }, []); */
