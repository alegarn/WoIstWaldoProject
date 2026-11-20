import { Image, StyleSheet, View } from 'react-native';

export type Props = {
  uris: (string | null | undefined)[];
};

const MAX_WARM_IMAGES = 7;

/**
 * Decodes upcoming card image bitmaps into RN's in-memory image cache by
 * mounting hidden off-screen <Image> components. When the caller swaps the
 * on-screen <ImageBackground> source to a URI warmed here, the bitmap is
 * already decoded and the advance feels instant.
 *
 * PT5 constraint: RN Image.prefetch is a no-op for file:// URIs; this
 * component is the workaround.
 */
export default function NextCardImageWarmer({ uris }: Props) {
  const warmList = uris
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, MAX_WARM_IMAGES);

  if (warmList.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {warmList.map((uri) => (
        <Image key={uri} source={{ uri }} style={styles.hidden} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
