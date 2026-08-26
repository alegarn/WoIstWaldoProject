import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import TierCard from '../../components/UI/TierCard';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { BILLING_TIERS } from '../../services/billing/offerings';
import { syncEntitlement } from '../../services/billing/billingApi';
import {
  getPurchasesModule,
  applyEntitlementToContext,
  entitlementToContextPayload,
  restoreAndSync,
} from '../../utils/purchases';

export default function PaywallScreen({ navigation, route }) {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const intent = route?.params?.intent;
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
      const all = result?.all ?? {};
      const resolved = BILLING_TIERS.map((tier) => {
        const offering = all[tier.offeringId] ?? result?.getOffering?.(tier.offeringId);
        const pkg = offering?.availablePackages?.[0];
        return pkg ? { pkg, tier } : null;
      }).filter(Boolean);
      setPackages(resolved);
    } catch (error) {
      Alert.alert(t('billing.paywall.loadFailed'), error?.message ?? '');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const applySyncAndRoute = useCallback(async () => {
    const response = await syncEntitlement(authContext);
    const ok = response?.status === 200;
    const entitlement = response?.data;
    if (ok && entitlement) {
      authContext.setEntitlement(entitlementToContextPayload(entitlement));
    }
    if (!ok) {
      Alert.alert(
        t('billing.paywall.purchaseRecorded'),
        t('billing.paywall.purchaseRecordedMessage'),
      );
    }
    if (intent === 'create-group') {
      navigation.replace('CreateGroupScreen');
    } else {
      navigation.replace('SubscriptionManagementScreen');
    }
  }, [authContext, intent, navigation, t]);

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
      Alert.alert(t('billing.paywall.purchaseFailed'), error?.message ?? '');
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
      Alert.alert(t('billing.paywall.restoreFailed'), error?.message ?? '');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{t('billing.paywall.eyebrow')}</Text>
      <Text style={styles.headline}>{t('billing.paywall.headline')}</Text>
      <Text style={styles.sub}>{t('billing.paywall.sub')}</Text>
      <View style={styles.rule} />
    </View>
  );

  const renderFooter = () => (
    <Text style={styles.legal}>
      {t('billing.paywall.legal')}
    </Text>
  );

  const renderItem = ({ item }) => {
    const { pkg, tier } = item;
    const price = pkg?.product?.priceString ?? pkg?.priceString ?? '';
    return (
      <TierCard
        testID={tier.testId}
        image={tier.image}
        eyebrow={tier.eyebrow}
        title={tier.label}
        price={price}
        priceSuffix={tier.priceSuffix}
        isSubscription={tier.isSubscription}
        features={tier.features}
        ctaText={tier.ctaText}
        featured={tier.featured}
        accessibilityLabel={t('billing.paywall.subscribeLabel', { tier: tier.label })}
        onCta={() => handlePurchase(pkg)}
      />
    );
  };

  if (isLoading || isPurchasing) {
    return <LoadingOverlay message={isPurchasing ? t('billing.paywall.processingPurchase') : t('billing.paywall.loadingOfferings')} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={packages}
        keyExtractor={(item, index) => item?.tier?.key ?? `tier-${index}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={styles.empty}>{t('billing.paywall.empty')}</Text>}
        ListFooterComponent={renderFooter}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
      {restoreError && (
        <Text style={styles.error} testID="subscription-error">
          {t('billing.paywall.noSubscription')}
        </Text>
      )}
      <View style={styles.restoreWrap}>
        <BigButton
          text={t('billing.paywall.restorePurchases')}
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
