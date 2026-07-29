import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';

import Button from '../../components/UI/Button';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import {
  getPurchasesModule,
  applyEntitlementToContext,
  restoreAndSync,
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
});
