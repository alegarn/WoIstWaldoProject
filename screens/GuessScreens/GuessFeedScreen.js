import { Dimensions } from 'react-native';

import SwipeImage from '../../components/UI/SwipeImage';

// SwipeImage treats `category` and `language` as optional (defaults to 'all' / 'any').
// GuessFeedScreen is currently the only caller in the authenticated stack, but we
// still pass them explicitly so the cache namespace + filter plumbing stays explicit.
export default function GuessFeedScreen({ navigation, route }) {
  const { category, language } = route.params || {};

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const startGuessing = ({ item }) => {
    navigation.replace('GuessScreen', {
      ...route.params,
      ...item,
      category,
      language,
    });
  };

  return (
    <SwipeImage
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      startGuessing={startGuessing}
      category={category}
      language={language}
    />
  );
}
