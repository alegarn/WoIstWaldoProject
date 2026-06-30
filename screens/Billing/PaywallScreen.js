import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';

import BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import TierCard from '../../components/UI/TierCard';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { syncEntitlement } from '../../services/billing/billingApi';
import {
  getPurchasesModule,
  hasActiveEntitlement,
  applyEntitlementToContext,
  restoreAndSync,
} from '../../utils/purchases';

const TIER_CONFIG = {
  extendedGroup: {
    testId: 'paywall.tier.extended-group',
    label: 'Extended Group',
    eyebrow: 'EXTENDED',
    image: require('../../assets/categories/all-image-cat.webp'),
    features: ['Host larger group games', '10 more player slots', 'All core game modes'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: false,
  },
  privateGroup: {
    testId: 'paywall.tier.private-group',
    label: 'Private Group',
    eyebrow: 'PRIVATE',
    image: require('../../assets/home/WoIstWaldo-character-hide.webp'),
    features: ['Invite-only private rooms', 'You stop seeing mandatory ads', '10 members per room'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: true,
  },
  noAds: {
    testId: 'paywall.tier.no-ads',
    label: 'No Ads',
    eyebrow: 'AD-FREE',
    image: require('../../assets/home/WoIstWaldo-character-stats.webp'),
    features: ['Remove all ads', 'Uninterrupted play', 'Faster rounds'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: false,
  },
};

function pickPackageId(pkg) {
  return pkg?.identifier ?? pkg?.product?.identifier ?? pkg?.id;
}

function pickPackagePrice(pkg) {
  return pkg?.product?.priceString ?? pkg?.priceString ?? '';
}

function tierConfigForPackage(pkg) {
  const candidates = [pkg?.product?.identifier, pickPackageId(pkg)];
  for (const id of candidates) {
    if (id && TIER_CONFIG[id]) {
      return TIER_CONFIG[id];
    }
  }
  return {
    testId: 'paywall.tier.unknown',
    label: 'Subscribe',
    eyebrow: 'TIER',
    image: undefined,
    features: ['Unlock premium features'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: false,
  };
}

export default function PaywallScreen({ navigation, route }) {
  const authContext = useContext(AuthContext);
  const intent = route?.params?.intent;
  const [offerings, setOfferings] = useState(null);
  const [packages, setPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [restoreError, setRestoreError] = useState(false);

  const loadOfferings = useCallback(async () => {
    const Purchases = getPurchasesModule();
    if (!Purchases) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await Purchases.getOfferings();
      setOfferings(result);
      const current = result?.current;
      setPackages(current?.availablePackages ?? []);
    } catch (error) {
      Alert.alert('Could not load offerings', error?.message ?? '');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const applySyncAndRoute = useCallback(async () => {
    const response = await syncEntitlement(authContext);
    const entitlement = response?.data;
    if (entitlement) {
      authContext.setEntitlement({
        isPremium: entitlement.is_premium,
        premiumTier: entitlement.premium_tier,
        premiumExpiresAt: entitlement.premium_expires_at,
      });
    }
    if (intent === 'create-group') {
      navigation.replace('CreateGroupScreen');
    } else {
      navigation.replace('SubscriptionManagementScreen');
    }
  }, [authContext, intent, navigation]);

  const handlePurchase = async (pkg) => {
    const Purchases = getPurchasesModule();
    if (!Purchases || !pkg) {
      return;
    }
    setIsPurchasing(true);
    try {
      const customerInfo = await Purchases.purchasePackage(pkg);
      if (hasActiveEntitlement(customerInfo)) {
        try {
          authContext.setEntitlement({
            isPremium: true,
            premiumTier: undefined,
            premiumExpiresAt: undefined,
          });
        } catch (_) {}
      }
      await applySyncAndRoute();
    } catch (error) {
      if (error?.userCancelled) {
        return;
      }
      Alert.alert('Purchase failed', error?.message ?? '');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const Purchases = getPurchasesModule();
    if (!Purchases) {
      return;
    }
    setRestoreError(false);
    try {
      const result = await restoreAndSync(authContext);
      if (!result.hasEntitlement) {
        setRestoreError(true);
        return;
      }
      applyEntitlementToContext(authContext, result.entitlement);
    } catch (error) {
      setRestoreError(true);
      Alert.alert('Restore failed', error?.message ?? '');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>STORE</Text>
      <Text style={styles.headline}>Find your plan</Text>
      <Text style={styles.sub}>Unlock more ways to play. Pick the tier that fits.</Text>
      <View style={styles.rule} />
    </View>
  );

  const renderFooter = () => (
    <Text style={styles.legal}>
      Auto-renews monthly. Cancel anytime from your store settings.
    </Text>
  );

  const renderItem = ({ item }) => {
    const cfg = tierConfigForPackage(item);
    return (
      <TierCard
        testID={cfg.testId}
        image={cfg.image}
        eyebrow={cfg.eyebrow}
        title={cfg.label}
        price={pickPackagePrice(item)}
        priceSuffix={cfg.priceSuffix}
        isSubscription={cfg.isSubscription}
        features={cfg.features}
        ctaText={cfg.ctaText}
        featured={cfg.featured}
        accessibilityLabel={`Subscribe to ${cfg.label}`}
        onCta={() => handlePurchase(item)}
      />
    );
  };

  if (isLoading || isPurchasing) {
    return <LoadingOverlay message={isPurchasing ? 'Processing purchase...' : 'Loading offerings...'} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={packages}
        keyExtractor={(item, index) => pickPackageId(item) ?? `package-${index}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={styles.empty}>No offerings available right now.</Text>}
        ListFooterComponent={renderFooter}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
      {restoreError && (
        <Text style={styles.error} testID="subscription-error">
          No active subscription found.
        </Text>
      )}
      <View style={styles.restoreWrap}>
        <BigButton
          text="Restore purchases"
          onPress={handleRestore}
          testID="paywall.button.restore"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor900,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  eyebrow: {
    color: GlobalStyle.color.quaternaryColor,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  sub: {
    color: GlobalStyle.color.secondaryColor,
    fontSize: 14,
    marginTop: 4,
  },
  rule: {
    height: 1,
    backgroundColor: GlobalStyle.color.tertiaryColor,
    marginVertical: 12,
  },
  empty: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  legal: {
    color: GlobalStyle.color.quaternaryColor,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  error: {
    color: GlobalStyle.color.error500,
    textAlign: 'center',
    marginTop: 8,
  },
  restoreWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
});
