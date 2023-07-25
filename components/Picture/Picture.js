import  { useState, useLayoutEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { handleImageOrientation } from "../../utils/orientation";
import { handleImageSize } from "../../utils/imageSize";

export default function Picture({ uri, isPortrait, imageWidth, imageHeight, screenHeight, screenWidth }) {
  console.log("screenWidth: ", screenWidth);
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0 });
/*   const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
 */
  const imageIsPortrait = imageWidth < imageHeight;

/*   useEffect(() => {
    const updateScreenDimensions = () => {
      setScreenDimensions(Dimensions.get('window'));
    };

    Dimensions.addEventListener('change', updateScreenDimensions);

    return () => {
      Dimensions.removeEventListener('change', updateScreenDimensions);
    };
  }, []); */

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
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <ImageBackground source={{ uri: uri }} style={[styles.image, { width: screenWidth - 10, height: screenHeight }]}>
          {touchLocation && (
            <Text style={styles.locationText}>
              Touch Location: {touchLocation.x}, {touchLocation.y}
            </Text>
          )}
        </ImageBackground>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  pressable: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 20,
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
});
