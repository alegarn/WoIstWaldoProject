import { Pressable, View, Text, ImageBackground, StyleSheet } from 'react-native';

import { getCategoryAsset } from '../../utils/categoryAssets';
import { GlobalStyle } from '../../constants/theme';

function isRemoteThumbnail(value) {
  return typeof value === 'string' && value.length > 0;
}

export default function GuessCategoryCard({ category, thumbnailUrl, count, onPress, testIDPrefix }) {
  const cardTestID = `${testIDPrefix}.card.${category.id}`;
  const useRemote = isRemoteThumbnail(thumbnailUrl);
  const source = useRemote ? { uri: thumbnailUrl } : getCategoryAsset(category?.key);

  return (
    <Pressable onPress={onPress} testID={cardTestID} style={styles.card}>
      {source !== undefined ? (
        <ImageBackground source={source} style={styles.image} imageStyle={styles.imageRadius}>
          <View style={styles.overlay} />
          <Text style={styles.name}>{category.name}</Text>
          {renderCountBadge(count, cardTestID)}
        </ImageBackground>
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <Text style={styles.name}>{category.name}</Text>
          {renderCountBadge(count, cardTestID)}
        </View>
      )}
    </Pressable>
  );
}

function renderCountBadge(count, cardTestID) {
  if (count === undefined || count === 0) {
    return null;
  }

  return (
    <View style={styles.countBadge}>
      <Text testID={`${cardTestID}.count`} style={styles.countText}>
        {count}
      </Text>
    </View>
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
  fallback: {
    backgroundColor: 'GlobalStyle.color.tertiaryColor900',
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
