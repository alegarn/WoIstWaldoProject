import { Dimensions } from 'react-native';

import HidePicture from '../components/Picture/HidePicture';

export default function HideScreen({ navigation, route }) {

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  let screenDimensions = { width: screenWidth, height: screenHeight };
  screenWidth > screenHeight ? screenDimensions = { width: screenHeight, height: screenWidth } : null;

  return (
    <>
      <HidePicture
        navigation={navigation}
        uri={route.params?.uri}
        imageWidth={route.params?.imageWidth}
        imageHeight={route.params?.imageHeight}
        screenDimensions={screenDimensions}
        isPortrait={route.params?.isPortrait} />
    </>
  );
}



/*   const [isTakingPicture, setIsTakingPicture] = useState(true);

  function changeStep() {
    setIsTakingPicture(false)
  }
 */
/*   if (isTakingPicture) {
    return <ImagePicker nextStep={changeStep} />
  }; */
