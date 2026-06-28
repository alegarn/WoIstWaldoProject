import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { usePrivateFeed } from '../../hooks/usePrivateFeed';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupFeedApi', () => ({
  fetchPrivateFeedPage: jest.fn(),
}));

jest.mock('../../services/groups/groupFeedCache', () => ({
  readGroupFeedCache: jest.fn(),
  writeGroupFeedCache: jest.fn(),
}));

import { fetchPrivateFeedPage } from '../../services/groups/groupFeedApi';
import { readGroupFeedCache, writeGroupFeedCache } from '../../services/groups/groupFeedCache';

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

function Wrapper({ children }) {
  return (
    <AuthContext.Provider value={{ token: TOKEN, userId: USER_ID }}>
      {children}
    </AuthContext.Provider>
  );
}

describe('usePrivateFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readGroupFeedCache.mockResolvedValue(null);
    writeGroupFeedCache.mockResolvedValue(undefined);
  });

  it('returns the network page and flips isLoading off once fetch resolves', async () => {
    const page = { images: [{ id: 'pi-1' }], nextCursor: null };
    fetchPrivateFeedPage.mockResolvedValue({ status: 200, data: page });

    const { result } = renderHook(
      () => usePrivateFeed({ groupId: 'g-123' }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.images).toEqual(page.images);
    expect(fetchPrivateFeedPage).toHaveBeenCalledWith(
      { token: TOKEN, userId: USER_ID },
      expect.objectContaining({ groupId: 'g-123', cursor: null })
    );
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-123',
      expect.any(Object),
      { images: page.images, nextCursor: null }
    );
  });

  it('keeps the previous page visible when the network rejects', async () => {
    fetchPrivateFeedPage.mockResolvedValueOnce({
      status: 200,
      data: { images: [{ id: 'pi-1' }], nextCursor: null },
    });
    fetchPrivateFeedPage.mockResolvedValueOnce({
      status: 500,
      data: { error: 'boom' },
    });

    const { result } = renderHook(
      () => usePrivateFeed({ groupId: 'g-123' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.images).toHaveLength(1));

    await result.current.refresh();

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.images).toHaveLength(1);
    expect(result.current.error).toBeTruthy();
  });
});
