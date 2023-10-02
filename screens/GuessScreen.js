import { Dimensions } from 'react-native';

import GuessPicture from "../components/Picture/GuessPicture";

import { isOnTarget } from "../utils/targetLocation";

export default function GuessScreen({ navigation, route }) {

  const { accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation} = route.params;
  console.log("accountId", accountId, "imageFile", imageFile, "pictureId", pictureId, "description", description, "imageHeight", imageHeight, "imageWidth", imageWidth, "isPortrait", isPortrait, "hiddenLocation", hiddenLocation, "screenHeight", screenHeight, "screenWidth", screenWidth);

  console.log("isPortrait", isPortrait);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const uri = imageFile;

  let screenDimensions = { width: screenWidth, height: screenHeight };
  isPortrait ? null : screenDimensions = { width: screenHeight, height: screenWidth };

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
      screenDimensions={screenDimensions}
      toAdScreen={toAdScreen}
    />
  )
};
