jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import {
  bootstrapStoredAuthSession,
  checkSecureStoreItem,
  getBackendHeaders,
  getStoredAuthState,
} from '../utils/auth';

const storedSession = {
  token: 'Bearer persisted-token',
  uid: 'user@example.com',
  expiry: '1712345678',
  access_token: 'persisted-access-token',
  client: 'persisted-client',
  userId: '42',
  email: 'user@example.com',
  username: 'waldo',
  scoreId: '99',
  isTutorialFinished: JSON.stringify({
    isTutorial: false,
    guessPathDone: true,
    hidePathDone: true,
  }),
};

function mockStoredValues(values = {}) {
  SecureStore.getItemAsync.mockImplementation(async (key) => values[key] ?? null);
};

describe('auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to context when SecureStore does not have the requested item', async () => {
    mockStoredValues();

    const value = await checkSecureStoreItem({
      secureStoreValue: 'email',
      context: { email: 'fallback@example.com' },
    });

    expect(value).toBe('fallback@example.com');
  });

  it('uses persisted auth headers when context only contains a token', async () => {
    mockStoredValues(storedSession);

    const headers = await getBackendHeaders({
      token: storedSession.token,
      uid: '',
      expiry: '',
      access_token: '',
      client: '',
      userId: '',
    });

    expect(headers).toEqual({
      token: storedSession.token,
      uid: storedSession.uid,
      expiry: storedSession.expiry,
      access_token: storedSession.access_token,
      client: storedSession.client,
      userId: storedSession.userId,
    });
  });

  it('parses the persisted tutorial state during session reads', async () => {
    mockStoredValues(storedSession);

    const authState = await getStoredAuthState();

    expect(authState.isTutorialFinished).toEqual({
      isTutorial: false,
      guessPathDone: true,
      hidePathDone: true,
    });
  });

  it('rehydrates the full stored session when the persisted auth state is valid', async () => {
    mockStoredValues(storedSession);
    const restoreSession = jest.fn();

    const didRestoreSession = await bootstrapStoredAuthSession(restoreSession);

    expect(didRestoreSession).toBe(true);
    expect(restoreSession).toHaveBeenCalledWith({
      token: storedSession.token,
      uid: storedSession.uid,
      expiry: storedSession.expiry,
      access_token: storedSession.access_token,
      client: storedSession.client,
      userId: storedSession.userId,
      email: storedSession.email,
      username: storedSession.username,
      scoreId: storedSession.scoreId,
      isTutorialFinished: {
        isTutorial: false,
        guessPathDone: true,
        hidePathDone: true,
      },
    });
  });

  it('skips rehydration when the persisted token is invalid', async () => {
    mockStoredValues({
      ...storedSession,
      token: 'invalid-token',
    });
    const restoreSession = jest.fn();

    const didRestoreSession = await bootstrapStoredAuthSession(restoreSession);

    expect(didRestoreSession).toBe(false);
    expect(restoreSession).not.toHaveBeenCalled();
  });
});