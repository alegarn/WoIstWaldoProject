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
import { getRankingData, getUserScores, updateUserScore } from '../utils/scoreRequests';

describe('scoreRequests utilities', () => {
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
      scoreId: 'score-1',
    });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token' });
  });

  it('updates the current user score with the expected payload', async () => {
    axios.put.mockResolvedValue({ status: 200, data: { ok: true } });

    const response = await updateUserScore({
      score: 1,
      pictureId: 'image-1',
      context: { token: 'Bearer token' },
    });

    expect(axios.put).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/scores/score-1',
      {
        score: {
          score: 1,
          image_name: 'image-1',
        },
      },
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({ status: 200, message: { status: 200, data: { ok: true } } });
  });

  it('loads ranking data with query params for leaderboard mode changes', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { ranking: [] },
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { scope: 'global', top: 10, window: 'weekly', page: 2 }
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/scores',
      {
        headers: { Authorization: 'Bearer token' },
        params: { scope: 'global', top: 10, window: 'weekly', page: 2 },
      }
    );
    expect(response).toEqual({ status: 200, data: { ranking: [] } });
  });

  it('maps getUserScores failures into a status and message without throwing', async () => {
    axios.get.mockRejectedValue({
      request: { status: 401 },
      message: 'Unauthorized',
    });

    const response = await getUserScores({
      username: 'waldo',
      context: { token: 'Bearer token' },
    });

    expect(response).toEqual({ status: 401, message: 'Unauthorized' });
  });
});