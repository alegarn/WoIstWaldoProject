import { Pressable, View, Text, ImageBackground, StyleSheet } from 'react-native';

export default function GuessCategoryCard({ category, thumbnailUrl, count, onPress, testIDPrefix }) {
  return (
    <Pressable
      onPress={onPress}
      testID={`${testIDPrefix}.card.${category.id}`}
      style={styles.card}>
      <ImageBackground source={thumbnailUrl} style={styles.image} imageStyle={styles.imageRadius}>
        <View style={styles.overlay} />
        <Text style={styles.name}>{category.name}</Text>
        {count !== undefined && count !== 0 && (
          <View style={styles.countBadge}>
            <Text testID={`${testIDPrefix}.card.${category.id}.count`} style={styles.countText}>
              {count}
            </Text>
          </View>
        )}
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderRadius: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  name: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  countBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderBottomLeftRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
