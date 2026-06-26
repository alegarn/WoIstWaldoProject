import { View, Text, StyleSheet } from 'react-native';
import IconButton from '../../UI/IconButton';
import { GlobalStyle } from '../../../constants/theme';

export default function GuessDescription({ item, showFullDescription, toggleDescription, style }) {
  const text = item?.description || item?.fullDescription || item?.full_description;
  const hasDescription = !(text === undefined || text === '');

  return (
    <View style={[styles.descriptionArea, style]}>
      {hasDescription && (
        <IconButton
          icon={showFullDescription ? "chevron-down" : "chevron-up"}
          color={GlobalStyle.color.secondaryColor500}
          size={30}
          onPress={toggleDescription} />
      )}
      <Text
        style={styles.cardDescriptionStyle}
        testID="guess-description.text"
        numberOfLines={showFullDescription ? undefined : 2}>
        {hasDescription ? text : "No description"}
      </Text>
    </View>
  )
};

const styles = StyleSheet.create({
  descriptionArea: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  cardDescriptionStyle: {
    color: GlobalStyle.color.secondaryColor900,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
  },
});
