import { useState } from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Description from '../components/Picture/Descriptions/Description';
import CenteredModal from "../components/UI/CenteredModal";
import { imageUploader } from "../utils/fileUploader";

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
  const circle = route.params?.circle;


  const handlePressDescription = (enteredText) => {
    setDescription(enteredText);
    setShowModal(true);
  };

  const onCancelGoBack = () => {
    navigation.replace("HideScreen", { uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait });
  };

  const handleConfirmModal = () => {
    imageUploader({ description, uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation });
  };

  const onCancelModal = () => {
    setShowModal(false);
  };

  const modalContent =
  (
      <View style={styles.descriptionContainer}>
        <Text style={styles.modalTitle}>Do you want send your image with this description ?</Text>
        <Text style={styles.modalText}>{description}</Text>
      </View>
  );

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: uri }} style={[styles.image, { width: screenWidth, height: screenHeight }]}>
        <Description
          onSubmit={handlePressDescription}
          label="Describe the location"
          invalid={false}
          onCancel={onCancelGoBack}
          style={styles.input}
          textInputConfig={{ multiline: true }}/>
        <Ionicons name={"close-circle-outline"} color={"white"} size={circle.circleSize} style={[circle.circleStyle, { opacity: 0.5 }]}/>
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
    justifyContent: "center",
  },
  image: {
    resizeMode: 'contain',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  circleStyle: {
    zIndex: -1,
  },
  descriptionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 16,
    marginVertical: 10,
  },
  input: {

  }
})
