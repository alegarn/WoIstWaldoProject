import { useState, useEffect } from 'react';

import { Alert, Dimensions } from 'react-native';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import ShowImagePicker from './ShowImagePicker';

export default function LogicalImagePicker() {
  // Request camera permissions
  const [hasPermission, requestPermission] = useCameraPermissions();
  // State for the image url
  const [image, setImage] = useState(null);

  const navigation = useNavigation();

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isPortrait = screenHeight > screenWidth;


  useEffect(() => {
    showImage();
  }, [image])


  async function grantPermission(requestPermission) {
    const permissionResponse = await requestPermission();
    return permissionResponse.granted;
  }

  // Function to verify camera permission
  async function verifyPermission() {
    if (hasPermission.status === PermissionStatus.UNDETERMINED) {
      grantPermission(requestPermission);
    }
    if (hasPermission.status === PermissionStatus.DENIED) {
      return new Promise((resolve, reject) => {
        Alert.alert(
          "Insufficient Permissions",
          "Access to camera is denied",
          [
            {
              text: "Cancel",
              onPress: () => resolve(false),
              style: "cancel"
            },
            {
              text: "Grant Permission",
              onPress: () => {
                grantPermission(requestPermission);
                resolve(true);
              }
            }
          ],
          { cancelable: false }
        );
      });
    }
    return true;
  };


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

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };


  const showImage = () => {
    return(
      <ShowImagePicker
      takePictureHandler={takePictureHandler}
      pickImage={pickImage}
      image={image}
      screenWidth={screenWidth}
      screenHeight={screenHeight} />
    )
  };

  return (showImage());
}


