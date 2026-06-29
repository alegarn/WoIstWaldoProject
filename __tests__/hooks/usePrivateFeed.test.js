import { act, renderHook, waitFor } from '@testing-library/react-native';
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

  it('does not emit a React state-update warning when refresh resolves after unmount', async () => {
    let resolveRefresh;
    fetchPrivateFeedPage.mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(
      () => usePrivateFeed({ groupId: 'g-123' }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      result.current.refresh();
    });

    unmount();

    await act(async () => {
      resolveRefresh({ status: 200, data: { images: [{ id: 'late' }], nextCursor: null } });
    });

    const reactWarningCalls = consoleError.mock.calls.filter((args) =>
      typeof args[0] === 'string' && /state update on an unmounted component|Can't perform a React state update/i.test(args[0])
    );

    expect(reactWarningCalls).toHaveLength(0);

    consoleError.mockRestore();
  });

  it('loadMore guards against overlapping invocations and avoids duplicate rows', async () => {
    fetchPrivateFeedPage.mockResolvedValueOnce({
      status: 200,
      data: { images: [{ id: 'pi-1' }], nextCursor: 'cursor-2' },
    });

    const firstPageExtra = { status: 200, data: { images: [{ id: 'pi-2' }], nextCursor: null } };
    const secondPageExtra = { status: 200, data: { images: [{ id: 'pi-3' }], nextCursor: null } };

    let resolveFirst;
    let resolveSecond;
    fetchPrivateFeedPage.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    fetchPrivateFeedPage.mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    const { result } = renderHook(
      () => usePrivateFeed({ groupId: 'g-123' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.images).toEqual([{ id: 'pi-1' }]));

    await act(async () => {
      result.current.loadMore();
    });

    await act(async () => {
      result.current.loadMore();
    });

    await act(async () => {
      resolveFirst(firstPageExtra);
    });

    await act(async () => {
      resolveSecond(secondPageExtra);
    });

    const calls = fetchPrivateFeedPage.mock.calls.filter((call) =>
      call[1] && call[1].cursor === 'cursor-2'
    );

    expect(calls).toHaveLength(1);

    const ids = result.current.images.map((image) => image.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
