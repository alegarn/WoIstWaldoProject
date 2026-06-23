jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  buildE2ECategories: jest.fn(),
  isE2EMode: jest.fn(),
}));

import axios from 'axios';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { buildE2ECategories, isE2EMode } from '../utils/e2eMode';
import { getCategories } from '../utils/categoryRequests';

describe('categoryRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    buildE2ECategories.mockReturnValue([
      { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
    ]);
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({
      token: 'Bearer token',
      userId: '42',
      scoreId: 'score-1',
    });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token' });
  });

  it('returns normalized camelCase categories on a successful request', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'cat-1',
          key: 'nature',
          name: 'Nature',
          thumbnail_url: 'https://cdn.example/thumb.png',
          sort_order: 3,
        },
      ],
    });

    const response = await getCategories({ context: { token: 'Bearer token' } });

    expect(axios.get).toHaveBeenCalledWith(
      'https://backend.example/api/v1/categories',
      { headers: { Authorization: 'Bearer token' } }
    );
    expect(response).toEqual({
      data: [
        {
          id: 'cat-1',
          key: 'nature',
          name: 'Nature',
          thumbnail_url: 'https://cdn.example/thumb.png',
          sort_order: 3,
          thumbnailUrl: 'https://cdn.example/thumb.png',
          sortOrder: 3,
        },
      ],
    });
  });

  it('maps non-2xx failures into isError without throwing', async () => {
    axios.get.mockRejectedValue({
      request: { status: 500 },
      message: 'Request failed with status code 500',
    });

    const response = await getCategories({ context: { token: 'Bearer token' } });

    expect(response).toEqual({
      isError: true,
      message: 'Request failed with status code 500',
    });
  });

  it('returns seeded e2e categories without calling axios when e2e mode is active', async () => {
    isE2EMode.mockReturnValue(true);
    buildE2ECategories.mockReturnValue([
      { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
      { id: 'e2e-cat-nature', key: 'nature', name: 'Nature', thumbnailUrl: null, count: undefined },
    ]);

    const response = await getCategories({ context: { token: 'Bearer token' } });

    expect(buildE2ECategories).toHaveBeenCalled();
    expect(response).toEqual({
      data: [
        { id: 'e2e-default-category', key: 'all', name: 'Recent/All', thumbnailUrl: null, count: undefined },
        { id: 'e2e-cat-nature', key: 'nature', name: 'Nature', thumbnailUrl: null, count: undefined },
      ],
    });
    expect(axios.get).not.toHaveBeenCalled();
  });
});
