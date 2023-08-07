import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import CenteredModal from '../UI/CenteredModal';

export default function showPicture({ uri, screenHeight, screenWidth, touchLocation, handlePress, handleIconPress, handleConfirm, circle, showModal, onCancel }) {

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
        <CenteredModal onPress={handleConfirm} onCancel={onCancel} isModalVisible={showModal}>
          Is it hiding there ?
        </CenteredModal> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pressable: {
    flex: 1,
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
    borderColor: 'white',
  },
});
