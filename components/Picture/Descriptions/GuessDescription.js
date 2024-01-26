import { View, Text, StyleSheet } from 'react-native';
import IconButton from '../../UI/IconButton';
import { GlobalStyle } from '../../../constants/theme';

export default function GuessDescription({ item, showFullDescription, toggleDescription, style }) {

//   console.log("GuessDescription item", item?.description?.length); /* undefined */
//   console.log("GuessDescription showFullDescription", showFullDescription); /* false */

  // item?.description?.length > 3 -> 30
  // swipe up to show full description
  return (
    <View style={[styles.descriptionArea, style]}>
      {(item?.description?.length > 3) && (
          <IconButton
            icon= {showFullDescription ? "chevron-down" : "chevron-up"}
            color={GlobalStyle.color.secondaryColor500}
            size={30}
            /* onPress={toggleDescription} */ />
        )}
      <Text
        style={styles.cardDescriptionStyle}
        numberOfLines={showFullDescription ? undefined : 3}>
        {(item?.description === undefined || item?.description === "") ? "No description" : item?.description}
{/*         {`\n GuessDescription item: ${item?.description?.length} \n showFullDescription: ${showFullDescription} \n item: ${JSON.stringify(item)}`} */}      
      </Text>
    </View>
  )
};

const styles = StyleSheet.create({
  descriptionArea: {
    alignItems: 'center',
  },
  cardDescriptionStyle: {
    color: GlobalStyle.color.primaryColor300,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
  },
});