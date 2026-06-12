jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  buildE2ERankingRows: jest.fn(),
  buildE2ERankingResponse: jest.fn(),
  buildE2EUserScores: jest.fn(),
  isE2EMode: jest.fn(),
}));

import axios from 'axios';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { buildE2ERankingRows, buildE2ERankingResponse, buildE2EUserScores, isE2EMode } from '../utils/e2eMode';
import { getRankingData, getUserScores, updateUserScore } from '../utils/scoreRequests';

describe('scoreRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    buildE2ERankingRows.mockReturnValue([{ rank: '1', username: 'John', total_score: 100 }]);
    buildE2ERankingResponse.mockReturnValue({
      rows: [{ rank: '1', username: 'John', total_score: 100 }],
      me: null,
      meta: null,
      nextCursor: null,
      hasMore: false,
      pagy: null,
    });
    buildE2EUserScores.mockReturnValue({
      total: { total_score: 100, total_hide_score: 30, total_guess_score: 70 },
      hide_info: { hide_count: 2 },
      guess_info: { guess_count: 5 },
    });
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
      data: { data: { rows: [] } },
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
    expect(response).toEqual({
      status: 200,
      data: {
        rows: [],
        nextCursor: null,
        hasMore: false,
        me: null,
        meta: null,
        pagy: null,
      },
    });
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

  it('returns seeded leaderboard rows in e2e mode without calling axios', async () => {
    isE2EMode.mockReturnValue(true);

    const response = await getRankingData({ token: 'Bearer token' }, { scope: 'global' });

    expect(buildE2ERankingResponse).toHaveBeenCalledWith({ after: undefined, limit: undefined, scope: 'global', page: undefined });
    expect(response).toEqual({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'John', total_score: 100 }],
        me: null,
        meta: null,
        nextCursor: null,
        hasMore: false,
        pagy: null,
      },
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns seeded user-score details in e2e mode without calling axios', async () => {
    isE2EMode.mockReturnValue(true);

    const response = await getUserScores({ username: 'John', context: { token: 'Bearer token' } });

    expect(response).toEqual({
      status: 200,
      data: {
        total: { total_score: 100, total_hide_score: 30, total_guess_score: 70 },
        hide_info: { hide_count: 2 },
        guess_info: { guess_count: 5 },
      },
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('sends cursor params and normalizes a cursor envelope in normal mode', async () => {
    const rows = [
      { rank: '11', username: 'Alice', total_score: 90 },
      { rank: '12', username: 'Bob', total_score: 80 },
    ];
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        data: rows,
        next_cursor: 'next-cursor',
        has_more: true,
        limit: 20,
      },
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { scope: 'global', after: 'some-cursor', limit: 20 }
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/scores',
      {
        headers: { Authorization: 'Bearer token' },
        params: { scope: 'global', after: 'some-cursor', limit: 20 },
      }
    );
    expect(response).toEqual({
      status: 200,
      data: {
        rows,
        nextCursor: 'next-cursor',
        hasMore: true,
        me: null,
        meta: null,
        pagy: null,
      },
    });
  });

  it('passes cursor params to buildE2ERankingResponse in e2e mode', async () => {
    isE2EMode.mockReturnValue(true);
    buildE2ERankingResponse.mockReturnValue({
      rows: [{ rank: '6', username: 'E2E', total_score: 40 }],
      nextCursor: 'e2e-cursor-next',
      hasMore: false,
      me: null,
      meta: null,
      pagy: null,
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { after: 'any-cursor', limit: 10 }
    );

    expect(buildE2ERankingResponse).toHaveBeenCalledWith({ after: 'any-cursor', limit: 10, scope: undefined, page: undefined });
    expect(response).toEqual({
      status: 200,
      data: {
        rows: [{ rank: '6', username: 'E2E', total_score: 40 }],
        nextCursor: 'e2e-cursor-next',
        hasMore: false,
        me: null,
        meta: null,
        pagy: null,
      },
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('falls back to pagy normalization when backend returns legacy envelope after cursor attempt', async () => {
    const rows = [
      { rank: '11', username: 'Alice', total_score: 90 },
    ];
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        data: rows,
        pagy: { count: 100, pages: 5, page: 2, next: 3 },
      },
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { scope: 'global', after: 'some-cursor' }
    );

    expect(response).toEqual({
      status: 200,
      data: {
        rows,
        nextCursor: null,
        hasMore: true,
        me: null,
        meta: null,
        pagy: { count: 100, pages: 5, page: 2, next: 3 },
      },
    });
  });

  it('returns 400 status for invalid_cursor error from backend', async () => {
    axios.get.mockRejectedValue({
      request: { status: 400 },
      message: 'Request failed with status code 400',
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { scope: 'global', after: 'bad-cursor' }
    );

    expect(response).toEqual({
      status: 400,
      message: 'Request failed with status code 400',
    });
  });

  it('handles cursor first page with limit but no after param', async () => {
    const rows = [
      { rank: '1', username: 'Top', total_score: 200 },
      { rank: '2', username: 'Second', total_score: 150 },
    ];
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        data: rows,
        next_cursor: 'first-page-cursor',
        has_more: true,
        limit: 30,
      },
    });

    const response = await getRankingData(
      { token: 'Bearer token' },
      { scope: 'global', limit: 30 }
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/users/42/scores',
      {
        headers: { Authorization: 'Bearer token' },
        params: { scope: 'global', limit: 30 },
      }
    );
    expect(response).toEqual({
      status: 200,
      data: {
        rows,
        nextCursor: 'first-page-cursor',
        hasMore: true,
        me: null,
        meta: null,
        pagy: null,
      },
    });
  });
});