import { Pressable, ScrollView, Text, View, Image, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

const OTHER_CATEGORY = {
  key: 'other',
  name: 'Other',
  thumbnailUrl: null,
};

export default function CategoryChips({ selected, onSelect, categories = [], testIDPrefix }) {
  const visibleCategories = [
    OTHER_CATEGORY,
    ...categories.filter((category) => category?.key && category.key !== OTHER_CATEGORY.key),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {visibleCategories.map((category) => {
        const chipValue = category.key === OTHER_CATEGORY.key ? null : category.key;
        const isSelected = category.key === OTHER_CATEGORY.key ? selected == null : selected === category.key;
        const hasThumbnail = Boolean(category.thumbnailUrl);
        // TODO: backend serves placeholder thumbnail_url (seeds set nil); fallback renders until real assets are uploaded.
        return (
          <Pressable
            key={category.key}
            onPress={() => onSelect(chipValue)}
            testID={`${testIDPrefix}.chip.${category.key}`}
            style={[styles.chip, isSelected && styles.chipSelected]}>
            {hasThumbnail ? (
              <Image source={{ uri: category.thumbnailUrl }} style={styles.thumbnail} />
            ) : (
              <View
                testID={`${testIDPrefix}.chip.${category.key}.fallback`}
                style={[styles.thumbnail, styles.thumbnailFallback]}
              />
            )}
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CCC',
    backgroundColor: '#FFF',
  },
  chipSelected: {
    backgroundColor: GlobalStyle.color.primaryColor500,
    borderColor: GlobalStyle.color.primaryColor500,
  },
  thumbnail: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  thumbnailFallback: {
    backgroundColor: GlobalStyle.color.secondaryColor,
  },
  chipText: {
    fontSize: 14,
    color: '#1D133D',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
