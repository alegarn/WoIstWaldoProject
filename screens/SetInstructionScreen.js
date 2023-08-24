import { useState } from 'react';
import { View, ImageBackground, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';

import HideDescription from '../components/Picture/Descriptions/HideDescription';
import CenteredModal from "../components/UI/CenteredModal";
import ModalContent from '../components/UI/ModalContent';
import { imageUploader } from "../utils/fileUploader";
import { handleOrientation } from '../utils/orientation';

export default function SetInstructionsScreen({ navigation, route }) {

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  const uri = route.params?.uri;
  const imageWidth = route.params?.imageWidth;
  const imageHeight = route.params?.imageHeight;
  const screenHeight = route.params?.screenHeight;
  const screenWidth = route.params?.screenWidth;
  const isPortrait = route.params?.isPortrait;
  const touchLocation = route.params?.touchLocation;
  const target = route.params?.target;
  const imageDimensionStyle = { width: screenWidth, height: screenHeight }

  /*  */
console.log("description", description);

/*  */
  const handlePressDescription = (enteredText) => {
    setDescription(enteredText);
    setShowModal(true);
  };

  const onCancelGoBack = () => {
    navigation.replace("HideScreen", { uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait });
  };

  const handleConfirmModal = async () => {

    /*  */

    const getPermissions = async () => {
      console.log("getPermissions");
      console.log(permissionResponse);
/*
      if (permissionResponse.granted) {
        console.log("Permission granted");
        return true;
      };
      if (!permissionResponse.granted) {
        console.log("Permission denied");
        Alert.alert("Failed to save image, please accept permission to save image and audio.");
        return false;
      }; */

      // Detect if you can request this permission again
      if (permissionResponse.status === "undetermined") {
        const permissionResponse = await requestPermission();
      };
      if (!permissionResponse.canAskAgain || permissionResponse.status === "denied") {
        /**
         *   Code to open device setting then the user can manually grant the app
         *  that permission
         */
        Alert.alert("Insufficient Permissions", 'Access to  Photos and Videos / audio is denied');
        Linking.openSettings();
      } else {
        if (permissionResponse.status === "granted") {
          return true;
        }
      };
    };


    let permissionStatus = await getPermissions();
    if (!permissionStatus) {
      return;
    };


    const saveImage = async () => {
      try {
        await MediaLibrary.saveToLibraryAsync(uri);
        imageUploader({ description, uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation });
        // Save image to media library
        console.log("Image successfully saved");
      } catch (error) {
        console.log(error);
      };
    };


    const imageIsSaved = await saveImage();

    /*  */

    setShowModal(false);
    handleOrientation("portrait");

    navigation.replace("HomeScreen");
  };

  const onCancelModal = () => {
    setShowModal(false);
  };



  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: uri }}
        resizeMode='stretch'
        style={[styles.image, imageDimensionStyle]}
      >
        <HideDescription
          onSubmit={handlePressDescription}
          label="Describe the hidden point"
          invalid={false}
          onCancel={onCancelGoBack}
          textInputConfig={{ multiline: true }}/>
        <Ionicons name={"close-circle-outline"} color={"white"} size={target.targetSize} style={[target.targetStyle, { opacity: 0.5 }]}/>
      </ImageBackground>
      {showModal ?
      <CenteredModal onPress={handleConfirmModal} onCancel={onCancelModal} isModalVisible={showModal}>
        <ModalContent
          description={description}
          screenHeight={screenHeight}
          screenWidth={screenWidth}
          guessPath={false} />
      </CenteredModal> : null}
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  targetStyle: {
    zIndex: -1,
  },
});
