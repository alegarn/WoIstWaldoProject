import { Pressable, Text, View, Image, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

const OTHER_CATEGORY = {
  key: 'other',
  name: 'Other',
  thumbnailUrl: null,
};

export default function CategoryChips({ selected, onSelect, categories = [], testIDPrefix, variant = 'light' }) {
  const isOverlay = variant === 'overlay';
  const visibleCategories = [
    OTHER_CATEGORY,
    ...categories.filter((category) => category?.key && category.key !== OTHER_CATEGORY.key),
  ];

  return (
    <View style={styles.container}>
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
            style={[
              styles.chip,
              isOverlay && styles.chipOverlay,
              isSelected && styles.chipSelected,
              isSelected && isOverlay && styles.chipSelectedOverlay,
            ]}>
            {hasThumbnail ? (
              <Image source={{ uri: category.thumbnailUrl }} style={styles.thumbnail} />
            ) : (
              <View
                testID={`${testIDPrefix}.chip.${category.key}.fallback`}
                style={[styles.thumbnail, styles.thumbnailFallback]}
              />
            )}
            <Text style={[
              styles.chipText,
              isOverlay && styles.chipTextOverlay,
              isSelected && styles.chipTextSelected,
            ]}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  chipOverlay: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: GlobalStyle.color.primaryColor500,
    borderColor: GlobalStyle.color.primaryColor500,
  },
  chipSelectedOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFFFFF',
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
  chipTextOverlay: {
    color: '#FFFFFF',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
