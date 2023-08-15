
import GuessPicture from "../components/Picture/GuessPicture";
import { IMAGES } from "../data/dummy-data";

export default function GuessScreen({ navigation, route }) {

  const { accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth } = route.params;
  console.log("accountId", accountId, "imageFile", imageFile, "pictureId", pictureId, "description", description, "imageHeight", imageHeight, "imageWidth", imageWidth, "isPortrait", isPortrait, "hiddenLocation", hiddenLocation, "screenHeight", screenHeight, "screenWidth", screenWidth);

  // only in dev with local images
  const uri = IMAGES.filter((item) => item.pictureId === pictureId)[0].imageFile;
  console.log(uri);

  return(
    <GuessPicture
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageHeight={imageHeight}
      imageWidth={imageWidth}
      hiddenLocation={hiddenLocation}
      screenHeight={screenHeight}
      screenWidth={screenWidth}
    />
  )
};
