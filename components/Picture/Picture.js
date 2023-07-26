import  { useState, useLayoutEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, Dimensions, Modal, Button } from 'react-native';
import { handleImageOrientation } from "../../utils/orientation";
import { handleImageSize } from "../../utils/imageSize";

import { handlePicturePress } from '../../utils/targetLocation';

import { Ionicons } from '@expo/vector-icons';
import CenteredModal from '../UI/CenteredModal';

export default function Picture({  uri, isPortrait, imageWidth, imageHeight, screenHeight, screenWidth }) {

  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, circleSize: 0 });
  const [circle, setCircle] = useState(0);

  const [showModal, setShowModal] = useState(false);


  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    handleImageOrientation({ imageIsPortrait, isPortrait });
  }, []);

  const handlePress = (event) => {
    let { location, circle } = handlePicturePress({event, screenWidth, screenHeight});
    setTouchLocation(location);
    setCircle(circle);
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
              <Ionicons name={"close-circle-outline"} color={"white"} size={circle.circleSize} style={circle.circleStyle}/>
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
