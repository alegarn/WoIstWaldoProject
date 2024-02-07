import { useState, useContext } from 'react';
import { View, ImageBackground, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';

import { AuthContext } from "../store/auth-context";

import HideDescription from '../components/Picture/Descriptions/HideDescription';
import CenteredModal from "../components/UI/CenteredModal";
import ModalContent from '../components/UI/ModalContent';
import { imageUploader } from "../utils/fileUploader";
import { handleOrientation } from '../utils/orientation';
import { handleImageType, isTypeValid } from '../utils/imageInfos';

import LoadingOverlay from '../components/UI/LoadingOverlay';

export default function SetInstructionsScreen({ navigation, route }) {

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [isLoading, setIsLoading] = useState(false);


  const uri = route.params?.uri;
  const imageWidth = route.params?.imageWidth;
  const imageHeight = route.params?.imageHeight;
  const screenHeight = route.params?.screenHeight;
  const screenWidth = route.params?.screenWidth;
  const isPortrait = route.params?.isPortrait;
  const touchLocation = route.params?.touchLocation;
  const target = route.params?.target;
  const imageDimensionStyle = route.params?.imageDimensionStyle;

  const context = useContext(AuthContext);

  const getPermissions = async () => {

    // Detect if you can request this permission again
    if (permissionResponse.status === "undetermined") {
      await requestPermission();
    };
    if (!permissionResponse.canAskAgain || permissionResponse.status === "denied") {
      Alert.alert("Insufficient Permissions", 'Access to  Photos and Videos / audio is denied');
      Linking.openSettings();
    } else {
      if (permissionResponse.status === "granted") {
        return true;
      };
    };
  };

  const handlePressDescription = async (enteredText) => {
    setDescription(enteredText);
    setShowModal(true);
  };

  const onCancelGoBack = () => {
    navigation.replace("HideScreen", { uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait });
  };

  const handleConfirmModal = async () => {

    let permissionStatus = await getPermissions();
    if (!permissionStatus) {
      return;
    };

    const fileExtension = handleImageType(uri);
    const validType = isTypeValid(fileExtension);

    if (!validType) {
      Alert.alert("Invalid image type", "Please select a valid image type (png, jpg or jpeg)");
      return;
    };

    const imageInfos = {
      uri: uri,
      userId: await SecureStore.getItemAsync("userId"),
      fileExtension: fileExtension,
      imageHeight: imageHeight,
      imageWidth: imageWidth,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      description: description,
      isPortrait: isPortrait,
      xLocation: touchLocation.x,
      yLocation: touchLocation.y,
    };

    setIsLoading(true);

    const uploadState = await imageUploader({ imageInfos, context });

    if (uploadState.status !== 200) {
      Alert.alert(`Uploading error: ${uploadState.title}`, uploadState.message+ "\nPlease try again later");
      return;
    };

    setShowModal(false);

    handleOrientation("portrait");
    setIsLoading(false);

    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeScreen' }],
    });
  };

  const onCancelModal = () => {
    setShowModal(false);
  };


  if (isLoading) {
    return <LoadingOverlay message={"Image is being uploaded"} />;
  };


  return (
    <View style={styles.container}>
      <ImageBackground
        source={{uri : uri}}
        resizeMode='stretch'
        style={imageDimensionStyle}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
  },
  targetStyle: {
    zIndex: -1,
  },
});
