import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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

function tierLabel(tier) {
  if (tier >= 3) return 'Premium';
  if (tier === 2) return 'Private Group';
  if (tier === 1) return 'No-ads';
  return 'Free';
}

function platformSubscriptionUrl() {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}

export default function SubscriptionManagementScreen({ navigation }) {
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
      Alert.alert('Restore failed', error?.message ?? '');
    } finally {
      setIsWorking(false);
    }
  }, [authContext]);

  const handleManage = useCallback(async () => {
    const url = platformSubscriptionUrl();
    try {
      const Linking = require('expo-linking');
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Could not open subscription settings', error?.message ?? '');
    }
  }, []);

  if (isWorking) {
    return <LoadingOverlay message="Restoring..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current plan</Text>
      <Text style={styles.tier}>{tierLabel(authContext?.paidTier ?? 0)}</Text>

      {refreshing && (
        <Text style={styles.refreshHint} testID="subscription-refresh.hint">
          Refreshing plan…
        </Text>
      )}

      {refreshError && (
        <View style={styles.refreshErrorRow}>
          <Text style={styles.error}>Couldn’t refresh plan.</Text>
          <TouchableOpacity
            accessibilityLabel="Retry plan refresh"
            onPress={refreshFromBackend}
            testID="subscription-refresh.retry"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {restoreError && (
        <Text style={styles.error} testID="subscription-error">
          No active subscription found.
        </Text>
      )}

      <View style={styles.buttonGroup}>
        {(authContext?.paidTier ?? 0) < 3 && (
          <Button
            accessibilityLabel="Upgrade"
            onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
            style={styles.button}
            testID="subscription-manage.button.upgrade"
          >
            Upgrade
          </Button>
        )}
        <Button
          accessibilityLabel="Restore purchases"
          onPress={handleRestore}
          style={styles.button}
          testID="subscription-manage.button.restore"
        >
          Restore purchases
        </Button>
        <Button
          accessibilityLabel="Manage subscription"
          onPress={handleManage}
          style={styles.button}
          testID="subscription-manage.button.manage"
        >
          Manage subscription
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
