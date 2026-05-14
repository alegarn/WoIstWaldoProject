import { useState, useEffect } from 'react';

import { Alert, Dimensions } from 'react-native';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';

import ShowImagePicker from './ShowImagePicker';
import { buildE2EHideRouteParams, isE2EMode } from '../../utils/e2eMode';

export default function LogicalImagePicker({ navigation, isTutorial }) {
  // Request camera permissions
  const [hasPermission, requestPermission] = useCameraPermissions();
  // State for the image url
  const [image, setImage] = useState(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const imageWidth = (8 / 10) * screenWidth;
  const imageHeight = (6 / 10) * screenHeight;


  useEffect(() => {
    showImage();
  }, [image])

  const navigateToHideScreen = ({ uri, width, height }) => {
    const isPortrait = height > width;

    navigation.navigate('HideScreen', {
      uri,
      imageWidth: width,
      imageHeight: height,
      screenHeight: isPortrait ? screenWidth : screenHeight,
      screenWidth: isPortrait ? screenHeight : screenWidth,
      isPortrait,
      isTutorial,
    });
  };


  async function grantPermission(requestPermission) {
    const permissionResponse = await requestPermission();
    return permissionResponse.granted;
  };

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
      mediaTypes: ['images'],
      quality: 0.5,
    });

    if (image?.canceled || !image?.assets?.length) {
      return null;
    }

    //
    //const fileInfo = await FileSystem.getInfoAsync(image.assets[0].uri);
    //const imageLength = fileInfo.size;
    //

    navigateToHideScreen({
      uri: image.assets[0].uri,
      width: image.assets[0].width,
      height: image.assets[0].height,
    });

    return null
  };

  const pickImage = async () => {
    if (isE2EMode()) {
      navigation.navigate('HideScreen', buildE2EHideRouteParams({ screenWidth, screenHeight, isTutorial }));
      return null;
    }

    // No permissions request is necessary for launching the image library
    let pickedImage = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ['images'],
      quality: 0.5,
    });

    if (pickedImage?.canceled || !pickedImage?.assets?.length) {
      return null;
    }

    setImage(pickedImage.assets[0].uri);
    console.log(pickedImage);


    navigateToHideScreen({
      uri: pickedImage.assets[0].uri,
      width: pickedImage.assets[0].width,
      height: pickedImage.assets[0].height,
    });

    return null;
  };


  const showImage = () => {
    return(
      <ShowImagePicker
        takePictureHandler={takePictureHandler}
        pickImage={pickImage}
        image={image}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        isTutorial={isTutorial} 
      />
    );
  };

  return (showImage());
};


