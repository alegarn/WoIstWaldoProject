import { useState, useEffect } from 'react';

import { Alert, Dimensions } from 'react-native';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';

import ShowImagePicker from './ShowImagePicker';

export default function LogicalImagePicker({ navigation }) {
  // Request camera permissions
  const [hasPermission, requestPermission] = useCameraPermissions();
  // State for the image url
  const [image, setImage] = useState(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isPortrait = screenHeight > screenWidth;
  const imageWidth = (8 / 10) * screenWidth;
  const imageHeight = (6 / 10) * screenHeight;


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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    //
    //const fileInfo = await FileSystem.getInfoAsync(image.assets[0].uri);
    //const imageLength = fileInfo.size;
    //


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
    let pickedImage = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
/*       aspect: [16, 9],
 */      quality: 0.5,
    });

    if (!pickedImage.canceled) {
      setImage(pickedImage.assets[0].uri);
      console.log(pickedImage);
    };

    navigation.navigate('HideScreen', {
      uri: pickedImage.assets[0].uri,
      imageWidth: pickedImage.assets[0].width,
      imageHeight: pickedImage.assets[0].height,
      screenHeight:isPortrait ? screenWidth : screenHeight,
      screenWidth:isPortrait ? screenHeight : screenWidth,
      isPortrait:isPortrait,
    });

  };


  const showImage = () => {
    return(
      <ShowImagePicker
      takePictureHandler={takePictureHandler}
      pickImage={pickImage}
      image={image}
      imageWidth={imageWidth}
      imageHeight={imageHeight} />
    );
  };

  return (showImage());
};


