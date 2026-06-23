import { Pressable, ScrollView, Text, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

export default function CategoryChips({ selected, onSelect, categories, testIDPrefix }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {categories.map((category) => {
        const isSelected = selected === category.key;
        return (
          <Pressable
            key={category.key}
            onPress={() => onSelect(category.key)}
            testID={`${testIDPrefix}.chip.${category.key}`}
            style={[styles.chip, isSelected && styles.chipSelected]}>
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
  chipText: {
    fontSize: 14,
    color: '#1D133D',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
