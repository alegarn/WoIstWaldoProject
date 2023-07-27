import Picture from '../components/Picture/Picture';

export default function HideScreen({ route }) {

  return (
    <>
      <Picture
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
