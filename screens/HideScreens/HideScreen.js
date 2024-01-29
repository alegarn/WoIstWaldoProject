import { Dimensions } from 'react-native';
import HidePicture from '../../components/Picture/HidePicture';

export default function HideScreen({ navigation, route }) {
  const uri = route.params?.uri;
  let screenDimensions = {};

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const isPortrait = route.params?.isPortrait;
  isPortrait ? (screenDimensions = { width: screenWidth, height: screenHeight }) : (screenDimensions = { width: screenHeight, height: screenWidth }) ;

  return (
    <>
      <HidePicture
        navigation={navigation}
        uri={uri}
        imageWidth={route.params?.imageWidth}
        imageHeight={route.params?.imageHeight}
        screenDimensions={screenDimensions}
        imageIsPortrait={isPortrait} />
    </>
  );
};
