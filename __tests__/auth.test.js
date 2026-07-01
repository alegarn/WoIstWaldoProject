jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import {
  bootstrapStoredAuthSession,
  checkSecureStoreItem,
  createUser,
  deleteAccount,
  getBackendHeaders,
  getScoreId,
  getStoredAuthState,
  hasCompleteAuthState,
  isPersistedBearerToken,
  login,
  updateUser,
} from '../utils/auth';

const storedSession = {
  token: 'Bearer persisted-token',
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
}

describe('auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
  });

  it('detects whether auth state is complete enough to build backend headers', () => {
    expect(
      hasCompleteAuthState({
        token: 'Bearer token',
        userId: '42',
      })
    ).toBe(true);

    expect(
      hasCompleteAuthState({
        token: 'Bearer token',
        userId: '',
      })
    ).toBe(false);
  });

  it('only treats persisted bearer tokens with the expected prefix and shape as valid', () => {
    expect(isPersistedBearerToken('Bearer persisted-token._+/=')).toBe(true);
    expect(isPersistedBearerToken('persisted-token')).toBe(false);
    expect(isPersistedBearerToken(null)).toBe(false);
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
      userId: '',
      scoreId: '',
    });

    expect(headers).toEqual({
      token: storedSession.token,
      userId: storedSession.userId,
      scoreId: storedSession.scoreId,
    });
  });

  it('keeps fully populated context headers instead of re-reading SecureStore', async () => {
    const headers = await getBackendHeaders({
      token: 'Bearer in-memory-token',
      userId: '55',
      scoreId: 'score-55',
    });

    expect(headers).toEqual({
      token: 'Bearer in-memory-token',
      userId: '55',
      scoreId: 'score-55',
    });
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('fills a missing score id from persisted storage when the context already has token and user id', async () => {
    mockStoredValues(storedSession);

    const headers = await getBackendHeaders({
      token: 'Bearer in-memory-token',
      userId: '55',
      scoreId: '',
    });

    expect(headers).toEqual({
      token: 'Bearer in-memory-token',
      userId: '55',
      scoreId: storedSession.scoreId,
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
      userId: storedSession.userId,
      email: storedSession.email,
      username: storedSession.username,
      scoreId: storedSession.scoreId,
      isTutorialFinished: {
        isTutorial: false,
        guessPathDone: true,
        hidePathDone: true,
      },
      isPremium: null,
      premiumTier: null,
      premiumExpiresAt: null,
      isGroupOwner: null,
      activeGroupId: null,
      isPrivateMode: null,
    });
  });

  it('rehydrates the persisted entitlement and group fields as parsed values', async () => {
    mockStoredValues({
      ...storedSession,
      isPremium: JSON.stringify(true),
      premiumTier: JSON.stringify(2),
      premiumExpiresAt: JSON.stringify('2026-12-31T23:59:59Z'),
      isGroupOwner: JSON.stringify(true),
      activeGroupId: JSON.stringify(77),
      isPrivateMode: JSON.stringify(false),
    });

    const authState = await getStoredAuthState();

    expect(authState.isPremium).toBe(true);
    expect(authState.premiumTier).toBe(2);
    expect(authState.premiumExpiresAt).toBe('2026-12-31T23:59:59Z');
    expect(authState.isGroupOwner).toBe(true);
    expect(authState.activeGroupId).toBe(77);
    expect(authState.isPrivateMode).toBe(false);
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

  it('logs in against the backend auth endpoint and returns the raw response on success', async () => {
    const response = {
      status: 200,
      headers: { authorization: 'Bearer new-token' },
      data: { data: { id: '7' } },
    };
    axios.post.mockResolvedValue(response);

    const loginResponse = await login({ email: 'waldo@example.com', password: 'secret' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/auth/sign_in',
      { email: 'waldo@example.com', password: 'secret' },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    expect(loginResponse).toBe(response);
  });

  it('posts signup payloads to the backend and returns the raw response on success', async () => {
    const response = {
      status: 200,
      headers: {
        authorization: 'Bearer signup-token',
      },
      data: {
        data: {
          id: '12',
          email: 'new@example.com',
          username: 'new-user',
          score_id: 'score-12',
          finished_tutorial: false,
        },
      },
    };
    axios.post.mockResolvedValue(response);

    const signupResponse = await createUser({
      email: 'new@example.com',
      password: 'hunter2',
      confirmPassword: 'hunter2',
      username: 'new-user',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/auth',
      {
        username: 'new-user',
        email: 'new@example.com',
        password: 'hunter2',
        password_confirmation: 'hunter2',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    expect(signupResponse).toBe(response);
  });

  it('loads the current score id with backend headers from context', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { score_id: 'score-42' },
    });

    const response = await getScoreId({
      token: 'Bearer token',
      userId: '42',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_score_id',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      })
    );
    expect(response).toEqual({ status: 200, data: { score_id: 'score-42' } });
  });

  it('maps updateUser failures into a status and error payload', async () => {
    axios.put.mockRejectedValue({
      request: { status: 500 },
      message: 'Request failed',
    });

    const response = await updateUser({
      context: {
        token: 'Bearer token',
        userId: '42',
      },
      data: { email: 'new@example.com' },
    });

    expect(response).toEqual({
      status: 500,
      data: expect.objectContaining({ message: 'Request failed' }),
    });
  });

  it('maps deleteAccount failures without throwing when the request metadata exists', async () => {
    axios.delete.mockRejectedValue({
      request: { status: 401 },
      message: 'Unauthorized',
    });

    const response = await deleteAccount({
      context: {
        token: 'Bearer token',
        userId: '42',
      },
    });

    expect(response).toEqual({
      status: 401,
      data: expect.objectContaining({ message: 'Unauthorized' }),
    });
  });
});
