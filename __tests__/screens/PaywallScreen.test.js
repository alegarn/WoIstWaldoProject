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
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import PaywallScreen from '../../screens/Billing/PaywallScreen';
import { AuthContext } from '../../store/auth-context';
import { syncEntitlement } from '../../services/billing/billingApi';
import Purchases from 'react-native-purchases';

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Purchases.getOfferings.mockResolvedValue({
      all: {
        no_ads_offering: { availablePackages: [ { identifier: '$rc_custom_c', product: { identifier: 'no_ads', priceString: '$2.99' } } ] },
        private_group_creator_offering: { availablePackages: [ { identifier: '$rc_custom_b', product: { identifier: 'private_group_creator', priceString: '$9.99' } } ] },
        premium: { availablePackages: [ { identifier: '$rc_custom_a', product: { identifier: 'premium', priceString: '$12.99' } } ] },
      },
    });
    Purchases.purchasePackage.mockResolvedValue({});
    Purchases.restorePurchases.mockResolvedValue({
      entitlements: { active: {} },
    });
    syncEntitlement.mockResolvedValue({
      status: 200,
      data: { is_paid: true, paid_tier: 2, paid_expires_at: null },
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

  it('renders one distinct tier testID per available package (premium, private-group-creator, no-ads)', async () => {
    const renderer = await renderScreen();

    const premiumCards = renderer.root.findAllByProps({ testID: 'paywall.tier.premium' });
    const privateGroupCards = renderer.root.findAllByProps({ testID: 'paywall.tier.private-group-creator' });
    const noAdsCards = renderer.root.findAllByProps({ testID: 'paywall.tier.no-ads' });

    expect(premiumCards.length).toBeGreaterThanOrEqual(1);
    expect(privateGroupCards.length).toBeGreaterThanOrEqual(1);
    expect(noAdsCards.length).toBeGreaterThanOrEqual(1);

    const subscribeByTier = {
      'paywall.tier.premium.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.premium.subscribe' }),
      'paywall.tier.private-group-creator.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.private-group-creator.subscribe' }),
      'paywall.tier.no-ads.subscribe': renderer.root.findAllByProps({ testID: 'paywall.tier.no-ads.subscribe' }),
    };

    expect(subscribeByTier['paywall.tier.premium.subscribe'].length).toBeGreaterThanOrEqual(1);
    expect(subscribeByTier['paywall.tier.private-group-creator.subscribe'].length).toBeGreaterThanOrEqual(1);
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

  it('routes back to GroupSettingsScreen after a purchase with intent personalize-group', async () => {
    const navigation = { replace: jest.fn() };
    const authContext = { setEntitlement: jest.fn() };
    const renderer = await renderScreen({ authContext, navigation, route: { params: { intent: 'personalize-group' } } });

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
    expect(navigation.replace).toHaveBeenCalledWith('GroupSettingsScreen');
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
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_paid: false } });

    const renderer = await renderScreen({ authContext: { setEntitlement: jest.fn() } });

    await act(async () => {
      renderer.root.findByProps({ testID: 'paywall.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'subscription-error' })).toBeTruthy();
  });

  it('surfaces the subscription-error testID when customerInfo is active but backend says the user is free', async () => {
    Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: { pro: {} } } });
    syncEntitlement.mockResolvedValue({ status: 200, data: { is_paid: false } });

    const authContext = { setEntitlement: jest.fn() };
    const renderer = await renderScreen({ authContext });

    await act(async () => {
      renderer.root.findByProps({ testID: 'paywall.button.restore' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(authContext.setEntitlement).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'subscription-error' })).toBeTruthy();
  });

  it('does not apply entitlement optimistically; tier is applied only from the syncEntitlement result', async () => {
    let resolveSync;
    syncEntitlement.mockReturnValue(new Promise((resolve) => { resolveSync = resolve; }));
    Purchases.purchasePackage.mockResolvedValue({ entitlements: { active: { private_group_creator: {} } } });

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
    expect(authContext.setEntitlement).not.toHaveBeenCalled();
    expect(syncEntitlement).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync({ status: 200, data: { is_paid: true, paid_tier: 3, paid_expires_at: null } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(authContext.setEntitlement).toHaveBeenCalledTimes(1);
    expect(authContext.setEntitlement).toHaveBeenCalledWith({
      isPaid: true,
      paidTier: 3,
      paidExpiresAt: null,
    });
  });

  it('applies isGroupOwner and activeGroupId from the syncEntitlement response after purchase', async () => {
    syncEntitlement.mockResolvedValue({
      status: 200,
      data: {
        is_paid: true,
        paid_tier: 2,
        paid_expires_at: null,
        is_group_owner: true,
        active_group_id: 'group-7',
      },
    });

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
    });

    expect(authContext.setEntitlement).toHaveBeenCalledTimes(1);
    expect(authContext.setEntitlement).toHaveBeenCalledWith({
      isPaid: true,
      paidTier: 2,
      paidExpiresAt: null,
      isGroupOwner: true,
      activeGroupId: 'group-7',
    });
  });

  it('surfaces Alert.alert and still navigates when syncEntitlement returns a non-200 status', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    syncEntitlement.mockResolvedValue({ status: 502, data: { error: 'revenuecat_unavailable' } });

    const navigation = { replace: jest.fn() };
    const authContext = { setEntitlement: jest.fn() };
    const renderer = await renderScreen({
      authContext,
      navigation,
      route: { params: { intent: 'create-group' } },
    });

    await act(async () => {
      const subscribeButtons = renderer.root.findAll((node) =>
        typeof node.props.testID === 'string' && node.props.testID.endsWith('.subscribe')
      );
      subscribeButtons[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncEntitlement).toHaveBeenCalledTimes(1);
    expect(authContext.setEntitlement).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('CreateGroupScreen');

    alertSpy.mockRestore();
  });

  function tierOrder(renderer) {
    const seen = [];
    renderer.root.findAll((node) => {
      const testID = node.props.testID;
      if (typeof testID === 'string' && /^paywall\.tier\.[a-z-]+$/.test(testID) && !seen.includes(testID)) {
        seen.push(testID);
      }
      return false;
    });
    return seen;
  }

  function flattenText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(flattenText).join('');
    return '';
  }

  function textsUnder(renderer, rootTestID) {
    const root = renderer.root.findAllByProps({ testID: rootTestID })[0];
    return root.findAll((node) => node.props.children !== undefined)
      .map((node) => flattenText(node.props.children));
  }

  it('features and orders the Creator card first for the personalize-group intent, with i18n-resolved copy', async () => {
    const renderer = await renderScreen({ route: { params: { intent: 'personalize-group' } } });

    expect(tierOrder(renderer)).toEqual([
      'paywall.tier.private-group-creator',
      'paywall.tier.premium',
      'paywall.tier.no-ads',
    ]);

    const creatorTexts = textsUnder(renderer, 'paywall.tier.private-group-creator').join('\n');
    expect(creatorTexts).toContain('Creator');
    expect(creatorTexts).toContain('Popular');
    expect(creatorTexts).toContain('Personalize your group home screen');
    expect(creatorTexts).toContain('Subscribe');

    const premiumTexts = textsUnder(renderer, 'paywall.tier.premium').join('\n');
    expect(premiumTexts).not.toContain('Popular');
  });

  it('keeps the default store ordering and premium featured flag without the personalize intent', async () => {
    const renderer = await renderScreen({ route: { params: {} } });

    expect(tierOrder(renderer)).toEqual([
      'paywall.tier.premium',
      'paywall.tier.private-group-creator',
      'paywall.tier.no-ads',
    ]);

    const premiumTexts = textsUnder(renderer, 'paywall.tier.premium').join('\n');
    expect(premiumTexts).toContain('Popular');

    const creatorTexts = textsUnder(renderer, 'paywall.tier.private-group-creator').join('\n');
    expect(creatorTexts).not.toContain('Popular');
  });
});
