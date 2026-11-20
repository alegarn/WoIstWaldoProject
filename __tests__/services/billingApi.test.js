jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
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
import { syncEntitlement } from '../../services/billing/billingApi';

const TOKEN = 'Bearer token-1';
const AUTH_HEADERS = { Authorization: TOKEN, HTTP_AUTHORIZATION: TOKEN };
const CONTEXT = { token: TOKEN, userId: 'user-1', scoreId: 'score-1' };

describe('services/billing/billingApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
  });

  it('syncEntitlement POSTs to the sync_entitlement endpoint with the bearer token', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { is_paid: true, paid_tier: 2 },
    });

    const response = await syncEntitlement(CONTEXT);

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example/api/v1/billing/sync_entitlement',
      {},
      { headers: AUTH_HEADERS }
    );
    expect(response).toEqual({
      status: 200,
      data: { is_paid: true, paid_tier: 2 },
    });
  });

  it('syncEntitlement surfaces API errors instead of swallowing them', async () => {
    axios.post.mockRejectedValue({
      response: { status: 401, data: { error: 'unauthorized' } },
    });

    const response = await syncEntitlement(CONTEXT);

    expect(response.status).toBe(401);
    expect(response.data).toEqual({ error: 'unauthorized' });
  });
});
