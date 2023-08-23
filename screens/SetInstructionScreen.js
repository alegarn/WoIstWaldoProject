import { useState } from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

import HideDescription from '../components/Picture/Descriptions/HideDescription';
import CenteredModal from "../components/UI/CenteredModal";
import { imageUploader } from "../utils/fileUploader";
import { handleOrientation } from '../utils/orientation';

export default function SetInstructionsScreen({ navigation, route }) {

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");

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
    imageUploader({ description, uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation });

    /*  */
    const saveImage = async (uri) => {
      try {
        // Request device storage access permission
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
        // Save image to media library
          await MediaLibrary.saveToLibraryAsync(uri);

          console.log("Image successfully saved");
        }
      } catch (error) {
        console.log(error);
      }
    };
    await saveImage(uri);
    /*  */

    handleOrientation("portrait");

    navigation.replace("HomeScreen");
  };

  const onCancelModal = () => {
    setShowModal(false);
  };

  let modalContent = (
      <>
        <Text style={styles.modalTitle}>Do you want to send your image with this description ?</Text>
        <Text style={styles.modalText}>{description}</Text>
      </>
    );


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
        {modalContent}
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 16,
  },
});
