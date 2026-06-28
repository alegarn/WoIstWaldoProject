const mockBigButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

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
import { act, create } from 'react-test-renderer';

import PaywallScreen from '../../screens/Billing/PaywallScreen';
import { AuthContext } from '../../store/auth-context';
import { syncEntitlement } from '../../services/billing/billingApi';
import Purchases from 'react-native-purchases';

const PACKAGES = [
  { identifier: 'premium_monthly', product: { priceString: '$4.99' } },
  { identifier: 'premium_plus_monthly', product: { priceString: '$9.99' } },
  { identifier: 'premium_plus_extension_monthly', product: { priceString: '$2.99' } },
];

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Purchases.getOfferings.mockResolvedValue({
      current: { availablePackages: PACKAGES },
    });
    Purchases.purchasePackage.mockResolvedValue({});
    Purchases.restorePurchases.mockResolvedValue({
      entitlements: { active: {} },
    });
    syncEntitlement.mockResolvedValue({
      status: 200,
      data: { is_premium: true, premium_tier: 2, premium_expires_at: null },
    });
  });

  async function renderScreen({ authContext = {}, navigation = { replace: jest.fn() }, route = { params: {} } } = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ ...authContext, setEntitlement: jest.fn() }}>
          <PaywallScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return renderer;
  }

  it('renders one tier card per available package (each carrying a paywall.tier.* testID and a .subscribe button)', async () => {
    const renderer = await renderScreen();

    const subscribeButtons = renderer.root.findAll((node) =>
      typeof node.props.testID === 'string' && node.props.testID.endsWith('.subscribe')
    );

    expect(subscribeButtons).toHaveLength(PACKAGES.length);
    expect(subscribeButtons.every((node) => node.props.testID.startsWith('paywall.tier.'))).toBe(true);
  });

  it('calls Purchases.purchasePackage then syncEntitlement and routes after a tier subscribe tap', async () => {
    const navigation = { replace: jest.fn() };
    const authContext = { setEntitlement: jest.fn() };
    const renderer = await renderScreen({ authContext, navigation, route: { params: { intent: 'create-group' } } });

    await act(async () => {
      const subscribeButtons = renderer.root.findAll((node) =>
        typeof node.props.testID === 'string' && node.props.testID.endsWith('.subscribe')
      );
      subscribeButtons[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.purchasePackage).toHaveBeenCalledTimes(1);
    expect(syncEntitlement).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('CreateGroupScreen');
  });

  it('invokes Purchases.restorePurchases when the restore button is pressed', async () => {
    const renderer = await renderScreen({ authContext: { setEntitlement: jest.fn() } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'paywall.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
    expect(syncEntitlement).toHaveBeenCalled();
  });

  it('surfaces the subscription-error testID when restore finds no active entitlement', async () => {
    Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_premium: false } });

    const renderer = await renderScreen({ authContext: { setEntitlement: jest.fn() } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'paywall.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'subscription-error' })).toBeTruthy();
  });
});
