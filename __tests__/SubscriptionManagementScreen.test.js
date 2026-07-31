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
});
