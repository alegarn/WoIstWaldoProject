jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  emptyImageList: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/billing/billingApi', () => ({
  __esModule: true,
  syncEntitlement: jest.fn(),
}));

import React, { useContext, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';

import AuthContextProvider, { AuthContext } from '../store/auth-context';
import { emptyImageList } from '../utils/storageDatum';
import { syncEntitlement } from '../services/billing/billingApi';

const Purchases = require('react-native-purchases').default;

function AuthContextProbe({ onValue }) {
  const value = useContext(AuthContext);

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

describe('AuthContextProvider', () => {
  let latestContext;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    latestContext = undefined;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-ios-key';
    syncEntitlement.mockResolvedValue({
      status: 200,
      data: { is_paid: true, paid_tier: 2, paid_expires_at: '2027-01-01T00:00:00Z' },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  });

  async function renderProvider() {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContextProvider>
          <AuthContextProbe onValue={(value) => {
            latestContext = value;
          }} />
        </AuthContextProvider>
      );
    });

    return renderer;
  }

  it('authenticates, persists the session, and marks tutorial progress from the backend flag', async () => {
    await renderProvider();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: true,
      });
    });

    expect(emptyImageList).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'Bearer token-123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userId', 'user-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('email', 'waldo@example.com');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('username', 'waldo');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('scoreId', 'score-9');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'isTutorialFinished',
      JSON.stringify({ isTutorial: false, guessPathDone: true, hidePathDone: true })
    );
    expect(latestContext.IsAuthenticated).toBe(true);
    expect(latestContext.token).toBe('Bearer token-123');
    expect(latestContext.headers).toEqual({
      token: 'Bearer token-123',
      userId: 'user-1',
      email: 'waldo@example.com',
      scoreId: 'score-9',
      username: 'waldo',
    });
    expect(latestContext.isTutorialFinished).toEqual({
      isTutorial: false,
      guessPathDone: true,
      hidePathDone: true,
    });
  });

  it('restores a persisted session payload without overwriting missing fields with undefined', async () => {
    await renderProvider();

    await act(async () => {
      latestContext.restoreSession({
        token: 'Bearer restored-token',
        userId: 'user-2',
        email: 'restored@example.com',
        username: 'restored-user',
        scoreId: 'score-2',
        isTutorialFinished: { isTutorial: true, guessPathDone: false, hidePathDone: false },
      });
    });

    expect(latestContext.IsAuthenticated).toBe(true);
    expect(latestContext.username).toBe('restored-user');
    expect(latestContext.scoreId).toBe('score-2');
    expect(latestContext.isTutorialFinished).toEqual({
      isTutorial: true,
      guessPathDone: false,
      hidePathDone: false,
    });
  });

  it('supports verifying and updating the current session state through public helpers', async () => {
    await renderProvider();

    SecureStore.getItemAsync.mockResolvedValueOnce('Bearer stored-token');
    let isLoggedIn;

    await act(async () => {
      isLoggedIn = await latestContext.verifyIsLoggedIn();
      await latestContext.saveScoreId('score-10');
      await latestContext.changeUserEmail('new@example.com');
      await latestContext.changeUsername('new-user');
      await latestContext.turnTutorialOn(true);
      await latestContext.updateTutorialStatus({ isTutorial: false, guessPathDone: true, hidePathDone: false });
    });

    expect(isLoggedIn).toBe(true);
    expect(latestContext.scoreId).toBe('score-10');
    expect(latestContext.email).toBe('new@example.com');
    expect(latestContext.username).toBe('new-user');
    expect(latestContext.isTutorialFinished).toEqual({
      isTutorial: false,
      guessPathDone: true,
      hidePathDone: false,
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('scoreId', 'score-10');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('email', 'new@example.com');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('username', 'new-user');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'isTutorialFinished',
      JSON.stringify({ isTutorial: false, guessPathDone: true, hidePathDone: false })
    );
  });

  it('logs out by clearing in-memory state, persisted credentials, and cached images', async () => {
    await renderProvider();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: false,
      });
    });

    emptyImageList.mockClear();

    await act(async () => {
      await latestContext.logout();
    });

    expect(latestContext.IsAuthenticated).toBe(false);
    expect(latestContext.token).toBe(null);
    expect(latestContext.headers).toEqual({});
    expect(latestContext.isTutorialFinished).toEqual({});
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userId');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('email');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('username');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('isTutorialFinished');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('scoreId');
    expect(emptyImageList).toHaveBeenCalledTimes(1);
  });

  it('registers a RevenueCat customer info listener on authenticate', async () => {
    await renderProvider();

    Purchases.addCustomerInfoUpdateListener.mockClear();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: false,
      });
    });

    expect(Purchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    expect(typeof Purchases.addCustomerInfoUpdateListener.mock.calls[0][0]).toBe('function');
  });

  it('debounces customer info listener updates into a single syncEntitlement call', async () => {
    await renderProvider();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: false,
      });
    });

    const listener = Purchases.addCustomerInfoUpdateListener.mock.calls.at(-1)[0];
    syncEntitlement.mockClear();

    jest.useFakeTimers();

    try {
      await act(async () => {
        listener({});
        listener({});
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(syncEntitlement).toHaveBeenCalledTimes(1);
      expect(latestContext.isPaid).toBe(true);
      expect(latestContext.paidTier).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('maps the synced entitlement to the context payload via customer info listener', async () => {
    await renderProvider();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: false,
      });
    });

    const listener = Purchases.addCustomerInfoUpdateListener.mock.calls.at(-1)[0];
    const setEntitlementSpy = jest.spyOn(latestContext, 'setEntitlement');
    syncEntitlement.mockResolvedValueOnce({
      status: 200,
      data: { is_paid: true, paid_tier: 3, paid_expires_at: null, is_group_owner: true, active_group_id: 'g1' },
    });

    jest.useFakeTimers();

    try {
      await act(async () => {
        listener({});
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setEntitlementSpy).toHaveBeenCalledWith({
        isPaid: true,
        paidTier: 3,
        paidExpiresAt: null,
        isGroupOwner: true,
        activeGroupId: 'g1',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('removes the registered customer info listener on logout', async () => {
    await renderProvider();

    await act(async () => {
      await latestContext.authenticate({
        token: 'Bearer token-123',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: false,
      });
    });

    const registeredListener = Purchases.addCustomerInfoUpdateListener.mock.calls.at(-1)[0];

    Purchases.removeCustomerInfoUpdateListener.mockClear();

    await act(async () => {
      await latestContext.logout();
    });

    expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    expect(Purchases.removeCustomerInfoUpdateListener.mock.calls[0][0]).toBe(registeredListener);
  });
});