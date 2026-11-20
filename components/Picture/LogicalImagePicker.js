import { useState, useEffect } from 'react';

import { Alert, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { launchCameraAsync, useCameraPermissions, PermissionStatus } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';

import ShowImagePicker from './ShowImagePicker';
import { buildE2EHideRouteParams, isE2EMode } from '../../utils/e2eMode';
import { processPickedImage } from '../../utils/imageProcessing';

export default function LogicalImagePicker({ navigation, isTutorial, scope }) {
  const { t } = useTranslation();
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
      scope,
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
          t('hide.insufficientPermissions'),
          t('hide.cameraDenied'),
          [
            {
              text: t('common.cancel'),
              onPress: () => resolve(false),
              style: "cancel"
            },
            {
              text: t('hide.grantPermission'),
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
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (image?.canceled || !image?.assets?.length) {
      return null;
    }

    const processed = await processPickedImage(image.assets[0]);

    if (processed.tooSmall) {
      Alert.alert(t('hide.imageTooSmall'), t('hide.retakeTooSmall'));
      return null;
    }

    //
    //const fileInfo = await FileSystem.getInfoAsync(image.assets[0].uri);
    //const imageLength = fileInfo.size;
    //

    navigateToHideScreen({
      uri: processed.uri,
      width: processed.width,
      height: processed.height,
    });

    return null
  };

  const pickImage = async () => {
    if (isE2EMode()) {
    navigation.navigate('HideScreen', { ...buildE2EHideRouteParams({ screenWidth, screenHeight, isTutorial }), scope });
      return null;
    }

    // No permissions request is necessary for launching the image library
    let pickedImage = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (pickedImage?.canceled || !pickedImage?.assets?.length) {
      return null;
    }

    const processed = await processPickedImage(pickedImage.assets[0]);

    if (processed.tooSmall) {
      Alert.alert(t('hide.imageTooSmall'), t('hide.pickTooSmall'));
      return null;
    }

    setImage(pickedImage.assets[0].uri);
    console.log(pickedImage);


    navigateToHideScreen({
      uri: processed.uri,
      width: processed.width,
      height: processed.height,
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


