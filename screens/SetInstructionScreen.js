import { View, ImageBackground, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Description from '../components/Picture/Descriptions/Description';
import CenteredModal from "../components/UI/CenteredModal";
import { imageUploader } from '../../utils/fileUploader';

export default function SetInstructionsScreen({ navigation, route }) {

  const uri = route.params?.uri;
  const imageWidth = route.params?.imageWidth;
  const imageHeight = route.params?.imageHeight;
  const screenHeight = route.params?.screenHeight;
  const screenWidth = route.params?.screenWidth;
  const isPortrait = route.params?.isPortrait;
  const touchLocation = route.params?.touchLocation;
  const circle = route.params?.circle;

   /*  const [showModal, setShowModal] = useState(false);


  const handleIconPress = () => {
    setShowModal(true);
  };

  const handleConfirm = () => {
    imageUploader({ uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation });
  };
*/
  const onCancel = () => {
    navigation.goBack();
  };


  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: uri }} style={[styles.image, { width: screenWidth, height: screenHeight }]}>
        <Description label="Describe the location"
          invalid={false}
          onCancel={onCancel}
          style={styles.input}
          textInputConfig={{ multiline: true }}/>
        <Ionicons name={"close-circle-outline"} color={"white"} size={circle.circleSize} style={circle.circleStyle}/>
      </ImageBackground>
      {/* {showModal ?
      <CenteredModal onPress={handleConfirm} onCancel={onCancel} isModalVisible={showModal}>
        Is it hiding there ?
      </CenteredModal> : null} */}
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
  input: {

  }
})
