jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
}));

import axios from 'axios';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { getIsTutorialFinished, isTutorialFinished } from '../utils/tutorialHandler';

describe('tutorialHandler utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({
      token: 'Bearer token',
      uid: 'waldo@example.com',
      expiry: '123',
      access_token: 'access',
      client: 'client',
      userId: '42',
    });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token' });
  });

  it('loads the persisted tutorial flag for the current user', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { is_tutorial_finished: true },
    });

    const response = await getIsTutorialFinished({ token: 'Bearer token' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/get_is_tutorial_finished',
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({
      status: 200,
      data: { is_tutorial_finished: true },
    });
  });

  it('injects the current user id into tutorial updates before sending them', async () => {
    axios.put.mockResolvedValue({
      status: 200,
      data: { ok: true },
    });

    const payload = {
      user: {
        is_tutorial_finished: true,
      },
    };

    const response = await isTutorialFinished({
      context: { token: 'Bearer token' },
      data: payload,
    });

    expect(payload.user.user_id).toBe('42');
    expect(axios.put).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/set_is_tutorial_finished',
      payload,
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toBeUndefined();
  });
});