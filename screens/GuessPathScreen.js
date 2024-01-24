import SwipeImage from '../components/UI/SwipeImage';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

export default function GuessPathScreen({ navigation }) {

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
    <SwipeImage
      screenWidth={SCREEN_WIDTH}
      screenHeight={SCREEN_HEIGHT}
      startGuessing={startGuessing}
    />
  );
};




