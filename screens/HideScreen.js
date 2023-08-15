import HidePicture from '../components/Picture/HidePicture';

export default function HideScreen({ navigation, route }) {

  return (
    <>
      <HidePicture
        navigation={navigation}
        uri={route.params?.uri}
        imageWidth={route.params?.imageWidth}
        imageHeight={route.params?.imageHeight}
        screenHeight={route.params?.screenHeight}
        screenWidth={route.params?.screenWidth}
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
