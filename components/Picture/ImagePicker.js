import { Alert, Dimensions } from 'react-native';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

import ShowImagePicker from './ShowImagePicker';

export default function ImagePicker() {
  // Request camera permissions
  const [hasPermission, requestPermission] = useCameraPermissions();

  const navigation = useNavigation();

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isPortrait = screenHeight > screenWidth;

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


  return (
    <ShowImagePicker takePictureHandler={takePictureHandler} />
  );
}


