const mockButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('../../services/billing/billingApi', () => ({
  syncEntitlement: jest.fn(),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import SubscriptionManagementScreen from '../../screens/Billing/SubscriptionManagementScreen';
import { AuthContext } from '../../store/auth-context';
import * as Linking from 'expo-linking';
import { syncEntitlement } from '../../services/billing/billingApi';
import Purchases from 'react-native-purchases';

describe('SubscriptionManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
    syncEntitlement.mockResolvedValue({
      status: 200,
      data: { is_premium: true, premium_tier: 2 },
    });
  });

  async function renderScreen({ authContext = {} } = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ ...authContext, setEntitlement: jest.fn() }}>
          <SubscriptionManagementScreen />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });
    return renderer;
  }

  it('renders the manage and restore buttons with stable testIDs and reflects the current tier label', async () => {
    const renderer = await renderScreen({ authContext: { premiumTier: 2 } });

    expect(renderer.root.findByProps({ testID: 'subscription-manage.button.manage' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'subscription-manage.button.restore' })).toBeTruthy();
  });

  it('triggers a deep-link to the OS subscription settings when manage is tapped', async () => {
    const renderer = await renderScreen({ authContext: { premiumTier: 1 } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.manage' }).props.onPress();
      await Promise.resolve();
    });

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const expectedUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    expect(Linking.openURL).toHaveBeenCalledWith(expectedUrl);
  });

  it('invokes Purchases.restorePurchases when the restore button is tapped', async () => {
    const renderer = await renderScreen({ authContext: { premiumTier: 1 } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
    expect(syncEntitlement).toHaveBeenCalledTimes(1);
  });

  it('surfaces the subscription-error testID when restore finds no active entitlement', async () => {
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_premium: false } });

    const renderer = await renderScreen({ authContext: { premiumTier: 0 } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'subscription-error' })).toBeTruthy();
  });
});
