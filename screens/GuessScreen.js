
import GuessPicture from "../components/Picture/GuessPicture";

import { IMAGES } from "../data/dummy-data";
import { isOnTarget } from "../utils/targetLocation";

export default function GuessScreen({ navigation, route }) {

/*   const { retry } = route.params;
  if (retry) {

  }; */
  const { accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth } = route.params;
  console.log("accountId", accountId, "imageFile", imageFile, "pictureId", pictureId, "description", description, "imageHeight", imageHeight, "imageWidth", imageWidth, "isPortrait", isPortrait, "hiddenLocation", hiddenLocation, "screenHeight", screenHeight, "screenWidth", screenWidth);

  console.log("isPortrait", isPortrait);

  // only in dev with local images
  const uri = IMAGES.filter((item) => item.pictureId === pictureId)[0].imageFile;

  const imageIsPortrait = imageWidth < imageHeight;

  function toAdScreen(targetInfos) {
    let onTarget = isOnTarget(targetInfos);
    navigation.navigate('AdScreen', { onTarget: onTarget, accountId: accountId, imageFile: uri, pictureId: pictureId, description: description, imageHeight: imageHeight, imageWidth:imageWidth, isPortrait: isPortrait, hiddenLocation: hiddenLocation, screenHeight: screenHeight, screenWidth: screenWidth });
  };


  return(
    <GuessPicture
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageIsPortrait={imageIsPortrait}
      hiddenLocation={hiddenLocation}
      screenHeight={screenHeight}
      screenWidth={screenWidth}
      toAdScreen={toAdScreen}
    />
  )
};
