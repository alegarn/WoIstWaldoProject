import { Dimensions } from 'react-native';

import GuessPicture from "../../components/Picture/GuessPicture";

import { isOnTarget } from "../../utils/targetLocation";
import TutorialOverlay from '../../components/UI/TutorialOverlay';

export default function GuessScreen({ navigation, route }) {

  const { imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, listId, isTutorial, category, language, scope, skipInstructions } = route.params;
  const isPrivate = scope?.kind === 'private';

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const uri = imageFile;

  let screenDimensions = {};
  isPortrait ?
    (screenDimensions = { width: screenWidth, height: screenHeight }) :
    (screenDimensions = { width: screenHeight, height: screenWidth });


  function toAdScreen(targetInfos) {
    let onTarget = isOnTarget(targetInfos);
    const sharedParams = {
      onTarget: onTarget,
      imageFile: uri,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      listId: listId,
      isTutorial: isTutorial,
      category,
      language,
      scope,
    };

    if (isPrivate) {
      navigation.replace('ResultScreen', sharedParams);
      return;
    }

    navigation.replace('AdScreen', sharedParams);
  };


  return(
    <>
    <GuessPicture
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageIsPortrait={isPortrait}
      imageHeight={imageHeight}
      imageWidth={imageWidth}
      hiddenLocation={hiddenLocation}
      screenDimensions={screenDimensions}
      toAdScreen={toAdScreen}
      skipInstructions={skipInstructions}
    />
    {
      isTutorial && 
        <TutorialOverlay
         screen={"GuessScreen"}
         isPortrait={isPortrait}
        />
      }
    </>  
  );
};
