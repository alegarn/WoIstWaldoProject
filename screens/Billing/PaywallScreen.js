import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';

import BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
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
  extendedGroup: { testId: 'paywall.tier.extended-group', label: 'Extended Group' },
  privateGroup: { testId: 'paywall.tier.private-group', label: 'Private Group' },
  noAds: { testId: 'paywall.tier.no-ads', label: 'No Ads' },
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
  return { testId: 'paywall.tier.unknown', label: 'Subscribe' };
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
          const { testId: tierTestId, label } = tierConfigForPackage(item);
          return (
            <View style={styles.tierCard} testID={tierTestId}>
              <Text style={styles.tierTitle}>{label}</Text>
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
