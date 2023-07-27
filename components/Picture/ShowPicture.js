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
