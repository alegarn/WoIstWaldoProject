jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  emptyImageList: jest.fn().mockResolvedValue(undefined),
}));

import React, { useContext, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';

import AuthContextProvider, { AuthContext } from '../store/auth-context';
import { emptyImageList } from '../utils/storageDatum';

function AuthContextProbe({ onValue }) {
  const value = useContext(AuthContext);

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

describe('AuthContextProvider', () => {
  let latestContext;

  beforeEach(() => {
    jest.clearAllMocks();
    latestContext = undefined;
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
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
        client: 'mobile-client',
        expiry: '12345',
        access_token: 'access-token',
        uid: 'waldo@example.com',
        userId: 'user-1',
        email: 'waldo@example.com',
        username: 'waldo',
        scoreId: 'score-9',
        isTutorialFinished: true,
      });
    });

    expect(emptyImageList).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'Bearer token-123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('client', 'mobile-client');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('expiry', '12345');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('uid', 'waldo@example.com');
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
      client: 'mobile-client',
      expiry: '12345',
      access_token: 'access-token',
      userId: 'user-1',
      uid: 'waldo@example.com',
      email: 'waldo@example.com',
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
        client: 'restored-client',
        expiry: '999',
        access_token: 'restored-access',
        uid: 'restored@example.com',
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
    expect(latestContext.uid).toBe('new@example.com');
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
        client: 'mobile-client',
        expiry: '12345',
        access_token: 'access-token',
        uid: 'waldo@example.com',
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
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('client');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('expiry');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('uid');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userId');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('email');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('username');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('isTutorialFinished');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('scoreId');
    expect(emptyImageList).toHaveBeenCalledTimes(1);
  });
});