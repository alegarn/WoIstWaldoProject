import { useState } from 'react';
import { Dimensions } from 'react-native';

import SwipeImage from '../../components/UI/SwipeImage';
import SwipeInstructions from '../../components/Instructions/SwipeInstructions';
import TutorialOverlay from '../../components/UI/TutorialOverlay';

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

export default function GuessPathScreen({ navigation, route }) {

  const [showOverlay, setShowOverlay] = useState(true);

  const isTutorial = route?.params?.isTutorial;

  const startGuessing = ({item}) => {
    navigation.replace('GuessScreen', {
      imageFile: item.imageFile,
      pictureId: item.pictureId,
      description: item.description,
      imageHeight: item.imageHeight,
      imageWidth: item.imageWidth,
      isPortrait: item.isPortrait,
      hiddenLocation: item.touchLocation,
      screenHeight: item.screenHeight,
      screenWidth: item.screenWidth,
      listId: item.listId,
      isTutorial: isTutorial
    });
  };

  return (
    showOverlay ? (
      <>
        <SwipeInstructions
          screenWidth={SCREEN_WIDTH}
          imageIsPortrait={true}
          handleFilterClick={() => setShowOverlay(false)}
        />
        {
          isTutorial && 
            <TutorialOverlay
              screen={"GuessPathScreen"}
              instructionsPosition={{top:0, left: 0}}
            />
        }
      </>
      
    ) : (
      <SwipeImage
        screenWidth={SCREEN_WIDTH}
        screenHeight={SCREEN_HEIGHT}
        startGuessing={startGuessing}
      />
    )
  );
};




