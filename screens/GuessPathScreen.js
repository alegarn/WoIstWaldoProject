import { useState } from 'react';
import { Dimensions } from 'react-native';

import SwipeImage from '../components/UI/SwipeImage';
import SwipeInstructions from '../components/Instructions/SwipeInstructions';

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

export default function GuessPathScreen({ navigation }) {

  const [showOverlay, setShowOverlay] = useState(true);

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
      listId: item.listId
    });
  };

  return (
    showOverlay ? (
      <SwipeInstructions
        screenWidth={SCREEN_WIDTH}
        imageIsPortrait={true}
        handleFilterClick={() => setShowOverlay(false)}
      />
    ) : (
      <SwipeImage
        screenWidth={SCREEN_WIDTH}
        screenHeight={SCREEN_HEIGHT}
        startGuessing={startGuessing}
      />
    )
  );
};




