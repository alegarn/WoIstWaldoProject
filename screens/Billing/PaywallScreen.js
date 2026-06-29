import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';

import BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { syncEntitlement } from '../../services/billing/billingApi';

const TIER_TEST_IDS = {
  premium: 'paywall.tier.premium',
  'premium-plus': 'paywall.tier.premium-plus',
  'premium-plus-extension': 'paywall.tier.premium-plus-extension',
};

const TIER_LABELS = {
  premium: 'Premium',
  'premium-plus': 'Premium+',
  'premium-plus-extension': 'Premium+ Extension',
};

const TIER_LOOKUP = [...Object.entries(TIER_TEST_IDS)]
  .map(([key, testId]) => [key.replaceAll('-', '_'), testId])
  .sort((a, b) => b[0].length - a[0].length);

function getPurchasesModule() {
  try {
    return require('react-native-purchases').default;
  } catch (error) {
    return null;
  }
}

function pickPackageId(pkg) {
  return pkg?.identifier ?? pkg?.product?.identifier ?? pkg?.id;
}

function pickPackagePrice(pkg) {
  return pkg?.product?.priceString ?? pkg?.priceString ?? '';
}

function tierTestIdForPackage(pkg) {
  const id = pickPackageId(pkg)?.replaceAll('-', '_');
  if (!id) return null;
  for (const [key, testId] of TIER_LOOKUP) {
    if (id === key || id.startsWith(key + '_')) return testId;
  }
  return null;
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
      await Purchases.purchasePackage(pkg);
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
      const info = await Purchases.restorePurchases();
      const response = await syncEntitlement(authContext);
      const entitlement = response?.data;
      const hasEntitlement = !!entitlement?.is_premium || (!!info && Object.keys(info.entitlements?.active ?? {}).length > 0);
      if (!hasEntitlement) {
        setRestoreError(true);
        return;
      }
      authContext.setEntitlement({
        isPremium: entitlement.is_premium,
        premiumTier: entitlement.premium_tier,
        premiumExpiresAt: entitlement.premium_expires_at,
      });
    } catch (error) {
      setRestoreError(true);
      Alert.alert('Restore failed', error?.message ?? '');
    }
  };

  if (isLoading || isPurchasing) {
    return <LoadingOverlay message={isPurchasing ? 'Processing purchase...' : 'Loading offerings...'} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={packages}
        keyExtractor={(item, index) => pickPackageId(item) ?? `package-${index}`}
        ListEmptyComponent={<Text style={styles.empty}>No offerings available right now.</Text>}
        renderItem={({ item }) => {
          const tierTestId = tierTestIdForPackage(item) ?? 'paywall.tier.premium';
          const tierKey = Object.keys(TIER_TEST_IDS).find(
            (key) => TIER_TEST_IDS[key] === tierTestId
          ) ?? 'premium';
          return (
            <View style={styles.tierCard} testID={tierTestId}>
              <Text style={styles.tierTitle}>{TIER_LABELS[tierKey] ?? 'Premium'}</Text>
              <Text style={styles.tierPrice}>{pickPackagePrice(item)}</Text>
              <BigButton
                text="Subscribe"
                onPress={() => handlePurchase(item)}
                testID={`${tierTestId}.subscribe`}
              />
            </View>
          );
        }}
      />
      {restoreError && (
        <Text style={styles.error} testID="subscription-error">
          No active subscription found.
        </Text>
      )}
      <BigButton
        text="Restore purchases"
        onPress={handleRestore}
        testID="paywall.button.restore"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 16 },
  tierCard: { backgroundColor: GlobalStyle.color.primaryColor800, padding: 16, marginVertical: 8, borderRadius: 8, alignItems: 'center', gap: 8 },
  tierTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tierPrice: { color: '#ffd700', fontSize: 18 },
  empty: { color: '#fff', textAlign: 'center', marginTop: 20 },
  error: { color: GlobalStyle.color.error500, textAlign: 'center', marginTop: 8 },
});
