import { Image, StyleSheet, Text, View } from 'react-native';
import { GlobalStyle } from '../../constants/theme';
import Button from './Button';

export default function TierCard({
  testID,
  image,
  eyebrow,
  title,
  price,
  priceSuffix,
  isSubscription,
  features,
  ctaText,
  onCta,
  featured,
  accessibilityLabel,
}) {
  return (
    <View testID={testID} style={[styles.card, featured && styles.cardFeatured]}>
      <View style={styles.hero}>
        {image ? (
          <Image source={image} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}
        {featured ? (
          <View style={styles.popularTag}>
            <Text style={styles.popularText}>Popular</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}

        {price ? (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {priceSuffix ? (
              <Text style={styles.priceSuffix}>{priceSuffix}</Text>
            ) : null}
          </View>
        ) : null}

        {isSubscription ? (
          <View style={styles.subscriptionPill}>
            <Text style={styles.subscriptionPillText}>Subscription</Text>
          </View>
        ) : null}

        {isSubscription ? (
          <Text style={styles.caption}>Auto-renews monthly</Text>
        ) : null}

        {features && features.length ? (
          <View style={styles.features}>
            {features.map((feature) => (
              <Text key={feature} style={styles.feature}>
                • {feature}
              </Text>
            ))}
          </View>
        ) : null}

        <Button
          testID={`${testID}.subscribe`}
          onPress={onCta}
          accessibilityLabel={accessibilityLabel}
          style={styles.cta}
        >
          {ctaText}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GlobalStyle.color.primaryColor800,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  cardFeatured: {
    borderWidth: 2,
    borderColor: GlobalStyle.color.secondaryColor,
  },
  hero: {
    width: '100%',
    height: 140,
    backgroundColor: GlobalStyle.color.primaryColor900,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor700,
  },
  popularTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: GlobalStyle.color.secondaryColor,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 8,
  },
  eyebrow: {
    color: GlobalStyle.color.quaternaryColor,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    color: GlobalStyle.color.win,
    fontSize: 20,
    fontWeight: '800',
  },
  priceSuffix: {
    color: GlobalStyle.color.quaternaryColor,
    fontSize: 13,
    fontWeight: '700',
  },
  subscriptionPill: {
    backgroundColor: GlobalStyle.color.secondaryColor,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginVertical: 6,
  },
  subscriptionPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  caption: {
    color: GlobalStyle.color.quaternaryColor,
    fontSize: 12,
  },
  features: {
    gap: 4,
  },
  feature: {
    color: GlobalStyle.color.secondaryColor,
    fontSize: 13,
  },
  cta: {
    alignSelf: 'stretch',
  },
});
