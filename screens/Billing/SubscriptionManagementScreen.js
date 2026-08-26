import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '../../components/UI/Button';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import {
  getPurchasesModule,
  applyEntitlementToContext,
  restoreAndSync,
  refreshEntitlement,
} from '../../utils/purchases';

function platformSubscriptionUrl() {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}

export default function SubscriptionManagementScreen({ navigation }) {
  const { t } = useTranslation();

  const tierLabel = (tier) => {
    if (tier >= 3) return t('billing.subscription.tierPremium');
    if (tier === 2) return t('billing.subscription.tierPrivateGroup');
    if (tier === 1) return t('billing.subscription.tierNoAds');
    return t('billing.subscription.tierFree');
  };

  const authContext = useContext(AuthContext);
  const [isWorking, setIsWorking] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const refreshFromBackend = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(false);
    const { ok } = await refreshEntitlement(authContext);
    setRefreshError(!ok);
    setRefreshing(false);
  }, [authContext]);

  useFocusEffect(
    useCallback(() => {
      refreshFromBackend();
    }, [refreshFromBackend])
  );

  const handleRestore = useCallback(async () => {
    const Purchases = getPurchasesModule();
    if (!Purchases) {
      return;
    }
    setIsWorking(true);
    setRestoreError(false);
    try {
      const result = await restoreAndSync(authContext);
      if (!result.hasEntitlement) {
        setRestoreError(true);
      } else {
        applyEntitlementToContext(authContext, result.entitlement);
      }
    } catch (error) {
      setRestoreError(true);
      Alert.alert(t('billing.paywall.restoreFailed'), error?.message ?? '');
    } finally {
      setIsWorking(false);
    }
  }, [authContext, t]);

  const handleManage = useCallback(async () => {
    const url = platformSubscriptionUrl();
    try {
      const Linking = require('expo-linking');
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(t('billing.subscription.openSettingsFailed'), error?.message ?? '');
    }
  }, []);

  if (isWorking) {
    return <LoadingOverlay message={t('billing.subscription.restoring')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('billing.subscription.currentPlan')}</Text>
      <Text style={styles.tier}>{tierLabel(authContext?.paidTier ?? 0)}</Text>

      {refreshing && (
        <Text style={styles.refreshHint} testID="subscription-refresh.hint">
          {t('billing.subscription.refreshing')}
        </Text>
      )}

      {refreshError && (
        <View style={styles.refreshErrorRow}>
          <Text style={styles.error}>{t('billing.subscription.refreshFailed')}</Text>
          <TouchableOpacity
            accessibilityLabel={t('billing.subscription.retryRefreshLabel')}
            onPress={refreshFromBackend}
            testID="subscription-refresh.retry"
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {restoreError && (
        <Text style={styles.error} testID="subscription-error">
          {t('billing.paywall.noSubscription')}
        </Text>
      )}

      <View style={styles.buttonGroup}>
        {(authContext?.paidTier ?? 0) < 3 && (
          <Button
            accessibilityLabel={t('billing.subscription.upgrade')}
            onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
            style={styles.button}
            testID="subscription-manage.button.upgrade"
          >
            {t('billing.subscription.upgrade')}
          </Button>
        )}
        <Button
          accessibilityLabel={t('billing.paywall.restorePurchases')}
          onPress={handleRestore}
          style={styles.button}
          testID="subscription-manage.button.restore"
        >
          {t('billing.paywall.restorePurchases')}
        </Button>
        <Button
          accessibilityLabel={t('billing.subscription.manage')}
          onPress={handleManage}
          style={styles.button}
          testID="subscription-manage.button.manage"
        >
          {t('billing.subscription.manage')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tier: { color: '#ffd700', fontSize: 24, marginTop: 8 },
  buttonGroup: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: '80%',
    marginVertical: 8,
    backgroundColor: GlobalStyle.color.primaryColor100,
  },
  error: { color: GlobalStyle.color.error500, marginTop: 12 },
  refreshHint: { color: '#cfcfcf', fontSize: 13, marginTop: 8 },
  refreshErrorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  retryText: { color: GlobalStyle.color.primaryColor100, fontWeight: '700', marginLeft: 8 },
});
