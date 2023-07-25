import { useState} from 'react';
import { View, Text, Button, Alert,  StyleSheet, Dimensions } from 'react-native';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

export default function ImagePicker() {
  // Request camera permissions
  const [hasPermission, requestPermission] = useCameraPermissions();

  const navigation = useNavigation();

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isPortrait = screenHeight > screenWidth;


  // Function to verify camera permission
  async function verifyPermission() {
    if (hasPermission.status === PermissionStatus.UNDETERMINED) {
      const permissionResponse = await requestPermission();
      return permissionResponse.granted;
    };
    if (hasPermission.status === PermissionStatus.DENIED) {
      Alert.alert("Insufficient Permissions", 'Access to camera is denied');
      return false;
    };
    return true;
  }

  // Function to handle taking a picture
  const takePictureHandler = async () => {
    const hasPermission = await verifyPermission();

    if (!hasPermission) {
      return;
    };

    // Launch the camera and capture an image
    const image = await launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
    });

    navigation.navigate('HideScreen', {
      uri: image.assets[0].uri,
      imageWidth: image.assets[0].width,
      imageHeight: image.assets[0].height,
      screenHeight:isPortrait ? screenWidth : screenHeight,
      screenWidth:isPortrait ? screenHeight : screenWidth,
      isPortrait:isPortrait,
    });

    return null
  };


  return (
    <View style={styles.container}>
      <Text>ImagePicker</Text>
      <View style={styles.imageContainer}>
        <Text>No image captured yet</Text>
      </View>
      <Button title="Pick an image from camera roll" onPress={takePictureHandler}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
