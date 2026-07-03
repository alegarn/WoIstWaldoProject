jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
  mapRequestError: jest.fn((error) => ({
    status: error?.response?.status ?? error?.request?.status,
    data: error?.response?.data ?? error,
  })),
}));

import axios from 'axios';
import { getBackendHeaders, setHeaders } from '../../utils/auth';
import {
  createGroupCategory,
  updateGroupCategory,
} from '../../services/groups/groupCategoriesApi';

const TOKEN = 'Bearer token-1';
const AUTH_HEADERS = { Authorization: TOKEN, HTTP_AUTHORIZATION: TOKEN };
const CONTEXT = { token: TOKEN, userId: 'user-1', scoreId: 'score-1' };

describe('services/groups/groupCategoriesApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
  });

  it('createGroupCategory POSTs thumbnail_image_id when thumbnailImageId is supplied', async () => {
    axios.post.mockResolvedValue({ status: 201, data: { data: { id: 'c-1' } } });

    await createGroupCategory(CONTEXT, 'g-1', { name: 'Cats', thumbnailImageId: 't-1' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/private_groups/g-1/categories/',
      { private_category: { name: 'Cats', sort_order: undefined, thumbnail_image_id: 't-1' } },
      { headers: AUTH_HEADERS }
    );
  });

  it('createGroupCategory omits thumbnail_image_id when thumbnailImageId is not supplied', async () => {
    axios.post.mockResolvedValue({ status: 201, data: { data: { id: 'c-2' } } });

    await createGroupCategory(CONTEXT, 'g-1', { name: 'Dogs' });

    const [, body] = axios.post.mock.calls[0];
    expect(body).toEqual({ private_category: { name: 'Dogs', sort_order: undefined } });
    expect(body.private_category).not.toHaveProperty('thumbnail_image_id');
  });

  it('updateGroupCategory PATCHes thumbnail_image_id when thumbnailImageId is supplied', async () => {
    axios.patch.mockResolvedValue({ status: 200, data: { data: { id: 'c-1' } } });

    await updateGroupCategory(CONTEXT, 'g-1', 'c-1', { thumbnailImageId: 't-2' });

    expect(axios.patch).toHaveBeenCalledWith(
      'https://backend.example/api/v1/private_groups/g-1/categories/c-1/',
      { private_category: { thumbnail_image_id: 't-2' } },
      { headers: AUTH_HEADERS }
    );
  });

  it('updateGroupCategory omits thumbnail_image_id when thumbnailImageId is not supplied', async () => {
    axios.patch.mockResolvedValue({ status: 200, data: { data: { id: 'c-1' } } });

    await updateGroupCategory(CONTEXT, 'g-1', 'c-1', { name: 'New' });

    const [, body] = axios.patch.mock.calls[0];
    expect(body).toEqual({ private_category: { name: 'New' } });
    expect(body.private_category).not.toHaveProperty('thumbnail_image_id');
  });
});
