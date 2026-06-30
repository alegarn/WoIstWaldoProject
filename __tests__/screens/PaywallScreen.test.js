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
  { identifier: '$rc_custom_a', product: { identifier: 'extendedGroup', priceString: '$4.99' } },
  { identifier: '$rc_custom_b', product: { identifier: 'privateGroup', priceString: '$9.99' } },
  { identifier: '$rc_custom_c', product: { identifier: 'noAds', priceString: '$2.99' } },
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
        <AuthContext.Provider value={{ setEntitlement: jest.fn(), ...authContext }}>
          <PaywallScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return renderer;
  }

  it('renders one distinct tier testID per available package (extended-group, private-group, no-ads)', async () => {
    const renderer = await renderScreen();

    const extendedGroupCards = renderer.root.findAllByProps({ testID: 'paywall.tier.extended-group' });
    const privateGroupCards = renderer.root.findAllByProps({ testID: 'paywall.tier.private-group' });
    const noAdsCards = renderer.root.findAllByProps({ testID: 'paywall.tier.no-ads' });

    expect(extendedGroupCards.length).toBeGreaterThanOrEqual(1);
    expect(privateGroupCards.length).toBeGreaterThanOrEqual(1);
    expect(noAdsCards.length).toBeGreaterThanOrEqual(1);

    const subscribeByTier = {
      'paywall.tier.extended-group.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.extended-group.subscribe' }),
      'paywall.tier.private-group.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.private-group.subscribe' }),
      'paywall.tier.no-ads.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.no-ads.subscribe' }),
    };

    expect(subscribeByTier['paywall.tier.extended-group.subscribe'].length).toBeGreaterThanOrEqual(1);
    expect(subscribeByTier['paywall.tier.private-group.subscribe'].length).toBeGreaterThanOrEqual(1);
    expect(subscribeByTier['paywall.tier.no-ads.subscribe'].length).toBeGreaterThanOrEqual(1);
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

  it('optimistically flips entitlement to premium after purchase before syncEntitlement resolves', async () => {
    let resolveSync;
    syncEntitlement.mockReturnValue(new Promise((resolve) => { resolveSync = resolve; }));
    Purchases.purchasePackage.mockResolvedValue({ entitlements: { active: { pro: {} } } });

    const navigation = { replace: jest.fn() };
    const authContext = { setEntitlement: jest.fn() };
    const renderer = await renderScreen({
      authContext,
      navigation,
      route: { params: { intent: 'store' } },
    });

    await act(async () => {
      const subscribeButtons = renderer.root.findAll((node) =>
        typeof node.props.testID === 'string' && node.props.testID.endsWith('.subscribe')
      );
      subscribeButtons[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Purchases.purchasePackage).toHaveBeenCalledTimes(1);
    expect(authContext.setEntitlement).toHaveBeenCalledWith(expect.objectContaining({ isPremium: true }));
    expect(syncEntitlement).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync({ status: 200, data: { is_premium: true, premium_tier: 1 } });
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
