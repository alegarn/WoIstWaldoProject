import SwipeImage from '../components/UI/SwipeImage';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width

export default function GuessPathScreen({ navigation }) {

  const startGuessing = ({item}) => {
    navigation.replace('GuessScreen', {
      accountId: item.accountId,
      imageFile: item.imageFile,
      pictureId: item.pictureId,
      description: item.description,
      imageHeight: item.imageHeight,
      imageWidth: item.imageWidth,
      isPortrait: item.isPortrait,
      hiddenLocation: item.touchLocation,
      screenHeight: item.screenHeight,
      screenWidth: item.screenWidth
    });
  };

  return (
    <SwipeImage
      screenWidth={SCREEN_WIDTH}
      startGuessing={startGuessing}
    />
  );
};




