const mockButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
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

jest.mock('../services/billing/billingApi', () => ({
  syncEntitlement: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import SubscriptionManagementScreen from '../screens/Billing/SubscriptionManagementScreen';
import { AuthContext } from '../store/auth-context';

describe('SubscriptionManagementScreen upgrade entry point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buttonTestIDs() {
    return mockButton.mock.calls.map(([props]) => props.testID);
  }

  async function renderScreen(contextValue) {
    const navigation = { navigate: jest.fn() };
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SubscriptionManagementScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return { renderer, navigation };
  }

  it('renders the upgrade button when tier < 3 and routes to the paywall with intent=store', async () => {
    const { navigation } = await renderScreen({ paidTier: 0 });

    const testIDs = buttonTestIDs();
    expect(testIDs).toContain('subscription-manage.button.upgrade');

    const upgradeCall = mockButton.mock.calls.find(
      ([props]) => props.testID === 'subscription-manage.button.upgrade'
    );

    await act(async () => {
      upgradeCall[0].onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });

  it('hides the upgrade button when tier === 3', async () => {
    await renderScreen({ paidTier: 3 });

    const testIDs = buttonTestIDs();
    expect(testIDs).not.toContain('subscription-manage.button.upgrade');
    expect(testIDs).toContain('subscription-manage.button.restore');
    expect(testIDs).toContain('subscription-manage.button.manage');
  });

  it('hides the upgrade button when a free user earned premium via group rewards', async () => {
    const { renderer } = await renderScreen({ paidTier: 0, earnedPremium: true });

    const testIDs = buttonTestIDs();
    expect(testIDs).not.toContain('subscription-manage.button.upgrade');
    expect(testIDs).toContain('subscription-manage.button.restore');
    expect(testIDs).toContain('subscription-manage.button.manage');
    expect(
      renderer.root.findByProps({ testID: 'subscription-manage.earned-badge' }).props.children
    ).toBe('Earned: Premium-equivalent (group reward)');
  });

  it('keeps the purchase-truth tier label and shows the earned badge at earnedPremium', async () => {
    const { renderer } = await renderScreen({ paidTier: 0, earnedPremium: true });

    expect(renderer.root.findByProps({ children: 'Free' })).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'subscription-manage.earned-badge' }).props.children
    ).toBe('Earned: Premium-equivalent (group reward)');
  });

  it('shows the earned-creator badge in the 9–18 band and keeps the upgrade button', async () => {
    const { renderer } = await renderScreen({
      paidTier: 0,
      earnedGroupCreator: true,
      earnedPremium: false,
    });

    expect(
      renderer.root.findByProps({ testID: 'subscription-manage.earned-badge' }).props.children
    ).toBe('Earned: Creator');
    expect(buttonTestIDs()).toContain('subscription-manage.button.upgrade');
  });

  it('shows no earned badge without earned flags', async () => {
    const { renderer } = await renderScreen({ paidTier: 2 });

    expect(
      renderer.root.findAllByProps({ testID: 'subscription-manage.earned-badge' })
    ).toHaveLength(0);
  });
});
