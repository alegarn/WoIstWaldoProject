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

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
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
      data: { is_paid: true, paid_tier: 2 },
    });
  });

  async function renderScreen({ authContext = {} } = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ setEntitlement: jest.fn(), ...authContext }}>
          <SubscriptionManagementScreen />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });
    return renderer;
  }

  it('renders the manage and restore buttons with stable testIDs and reflects the current tier label', async () => {
    const renderer = await renderScreen({ authContext: { paidTier: 2 } });

    expect(renderer.root.findByProps({ testID: 'subscription-manage.button.manage' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'subscription-manage.button.restore' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Private Group' })).toBeTruthy();
  });

  it('shows the Premium label for tier 3', async () => {
    const renderer = await renderScreen({ authContext: { paidTier: 3 } });

    expect(renderer.root.findByProps({ children: 'Premium' })).toBeTruthy();
  });

  it('triggers a deep-link to the OS subscription settings when manage is tapped', async () => {
    const renderer = await renderScreen({ authContext: { paidTier: 1 } });

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
    const renderer = await renderScreen({ authContext: { paidTier: 1 } });
    syncEntitlement.mockClear();

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
    expect(syncEntitlement).toHaveBeenCalledTimes(1);
  });

  it('surfaces the subscription-error testID when restore finds no active entitlement', async () => {
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_paid: false } });

    const renderer = await renderScreen({ authContext: { paidTier: 0 } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'subscription-error' })).toBeTruthy();
  });

  it('shows restore error when customerInfo is active but backend says the user is free', async () => {
    Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: { pro: {} } } });
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_paid: false } });

    const authContext = { paidTier: 0, setEntitlement: jest.fn() };
    const renderer = await renderScreen({ authContext });
    authContext.setEntitlement.mockClear();

    await act(async () => {
      renderer.root.findByProps({ testID: 'subscription-manage.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
    expect(authContext.setEntitlement).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'subscription-error' }).length).toBeGreaterThan(0);
  });

  describe('focus refresh', () => {
    it('calls syncEntitlement once on focus to re-sync the authoritative backend tier', async () => {
      await renderScreen({ authContext: { paidTier: 0 } });

      expect(syncEntitlement).toHaveBeenCalledTimes(1);
    });

    it('reflects the authoritative tier returned by the focus sync in the rendered plan label', async () => {
      syncEntitlement.mockResolvedValue({
        status: 200,
        data: {
          is_paid: true,
          paid_tier: 3,
          paid_expires_at: null,
          is_group_owner: false,
          active_group_id: null,
        },
      });

      function TierProvider() {
        const [paidTier, setPaidTier] = React.useState(0);
        const value = { paidTier, setEntitlement: ({ paidTier: tier }) => setPaidTier(tier ?? 0) };
        return (
          <AuthContext.Provider value={value}>
            <SubscriptionManagementScreen />
          </AuthContext.Provider>
        );
      }

      let renderer;
      await act(async () => {
        renderer = create(<TierProvider />);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderer.root.findByProps({ children: 'Premium' })).toBeTruthy();
    });

    it('shows the subscription-refresh.retry affordance and keeps the stale tier label when the focus sync fails', async () => {
      syncEntitlement.mockResolvedValue({ status: 502 });

      const renderer = await renderScreen({ authContext: { paidTier: 0 } });

      expect(renderer.root.findAllByProps({ testID: 'subscription-refresh.retry' }).length).toBeGreaterThan(0);
      expect(renderer.root.findByProps({ children: 'Free' })).toBeTruthy();
    });

    it('calls syncEntitlement again when the retry affordance is tapped', async () => {
      syncEntitlement.mockResolvedValue({ status: 502 });

      const renderer = await renderScreen({ authContext: { paidTier: 0 } });
      expect(syncEntitlement).toHaveBeenCalledTimes(1);

      await act(async () => {
        renderer.root.findByProps({ testID: 'subscription-refresh.retry' }).props.onPress();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(syncEntitlement).toHaveBeenCalledTimes(2);
    });
  });
});
