import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import _BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import TierCard from '../../components/UI/TierCard';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { BILLING_TIERS, CREATOR_TIER_KEY } from '../../services/billing/offerings';
import type { BillingTier } from '../../services/billing/offerings';
import { syncEntitlement } from '../../services/billing/billingApi';
import {
  getPurchasesModule,
  applyEntitlementToContext,
  entitlementToContextPayload,
  restoreAndSync,
} from '../../utils/purchases';

import type {
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

// BigButton.js is unmigrated; its destructured props (buttonStyle /
// accessibilityLabel) are inferred as required by TS. Permissive cast mirrors
// the App.tsx convention.
const BigButton = _BigButton as React.ComponentType<any>;

// Purchase packages come from react-native-purchases offerings via
// utils/purchases.js; pkg is the SDK's own PurchasesPackage shape.
type PaywallPackage = { pkg: PurchasesPackage; tier: BillingTier };

type PaywallIntent = 'create-group' | 'personalize-group' | 'store';

type PaywallRouteParams = {
  intent?: PaywallIntent;
  [key: string]: unknown;
};

type PaywallParamList = {
  PaywallScreen: PaywallRouteParams;
  CreateGroupScreen: undefined;
  GroupSettingsScreen: undefined;
  SubscriptionManagementScreen: undefined;
};

type PaywallScreenProps = {
  navigation: NativeStackNavigationProp<PaywallParamList, 'PaywallScreen'>;
  route: RouteProp<PaywallParamList, 'PaywallScreen'>;
};

export default function PaywallScreen({ navigation, route }: PaywallScreenProps) {
  const { t } = useTranslation();
  // auth-context.js infers its provider callbacks as zero-arg; this screen is
  // the one caller that hands setEntitlement a payload.
  const authContext = useContext(AuthContext) as { setEntitlement: (payload: unknown) => void };
  const intent = route?.params?.intent;
  const [packages, setPackages] = useState<PaywallPackage[]>([]);
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
      // Boundary view of the typed Purchases SDK result: this screen reaches
      // offerings through both the `all` map and the legacy getOffering lookup.
      const result = (await Purchases.getOfferings()) as PurchasesOfferings & {
        getOffering?: (offeringId: string) => PurchasesOffering | undefined;
      };
      const all = result?.all ?? {};
      const resolved = BILLING_TIERS.map((tier) => {
        const offering = all[tier.offeringId] ?? result?.getOffering?.(tier.offeringId);
        const pkg = offering?.availablePackages?.[0];
        return pkg ? { pkg, tier } : null;
      }).filter(Boolean) as PaywallPackage[];
      setPackages(resolved);
    } catch (error: any) {
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
    } else if (intent === 'personalize-group') {
      navigation.replace('GroupSettingsScreen');
    } else {
      navigation.replace('SubscriptionManagementScreen');
    }
  }, [authContext, intent, navigation, t]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    const Purchases = getPurchasesModule();
    if (!Purchases || !pkg) {
      return;
    }
    setIsPurchasing(true);
    try {
      await Purchases.purchasePackage(pkg);
      await applySyncAndRoute();
    } catch (error: any) {
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
    } catch (error: any) {
      setRestoreError(true);
      Alert.alert(t('billing.paywall.restoreFailed'), error?.message ?? '');
    }
  };

  // Intent-aware emphasis: arriving from a group-personalization upsell makes
  // the Creator tier the featured (highlighted) card, ordered first. The
  // default store view keeps the catalog's own ordering and featured flag.
  const isPersonalizeIntent = intent === 'personalize-group';
  const orderedPackages = isPersonalizeIntent
    ? [...packages].sort(
        (a, b) => Number(b.tier.key === CREATOR_TIER_KEY) - Number(a.tier.key === CREATOR_TIER_KEY),
      )
    : packages;

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

  const renderItem = ({ item }: { item: PaywallPackage }) => {
    const { pkg, tier } = item;
    const price = pkg?.product?.priceString ?? '';
    const label = t(tier.label);
    const featuresRaw = t(tier.features, { returnObjects: true });
    const features = Array.isArray(featuresRaw) ? (featuresRaw as string[]) : [];
    return (
      <TierCard
        testID={tier.testId}
        image={tier.image}
        eyebrow={t(tier.eyebrow)}
        title={label}
        price={price}
        priceSuffix={tier.priceSuffix}
        isSubscription={tier.isSubscription}
        features={features}
        ctaText={t(tier.ctaText)}
        featured={isPersonalizeIntent ? tier.key === CREATOR_TIER_KEY : tier.featured}
        accessibilityLabel={t('billing.paywall.subscribeLabel', { tier: label })}
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
        data={orderedPackages}
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
