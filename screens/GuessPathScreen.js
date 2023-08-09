import SwipeImage from '../components/UI/SwipeImage';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width

export default function GuessPathScreen({ navigation, route }) {

  return (
    <SwipeImage screenWidth={SCREEN_WIDTH} />
  )
};
