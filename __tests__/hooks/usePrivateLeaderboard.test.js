import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { usePrivateLeaderboard } from '../../hooks/usePrivateLeaderboard';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupLeaderboardApi', () => ({
  fetchPrivateLeaderboard: jest.fn(),
  fetchPrivateLeaderboardNext: jest.fn(),
}));

import {
  fetchPrivateLeaderboard,
  fetchPrivateLeaderboardNext,
} from '../../services/groups/groupLeaderboardApi';

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

function Wrapper({ children }) {
  return (
    <AuthContext.Provider value={{ token: TOKEN, userId: USER_ID }}>
      {children}
    </AuthContext.Provider>
  );
}

describe('usePrivateLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the first page and exposes rows + hasMore when fetch resolves', async () => {
    fetchPrivateLeaderboard.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ user_id: 'u-1', total_score: 100 }],
        nextCursor: 'cursor-2',
        hasMore: true,
      },
    });

    const { result } = renderHook(
      () => usePrivateLeaderboard({ groupId: 'g-7', limit: 20 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchPrivateLeaderboard).toHaveBeenCalledWith(
      { token: TOKEN, userId: USER_ID },
      { groupId: 'g-7', limit: 20 }
    );
    expect(result.current.rows).toEqual([{ user_id: 'u-1', total_score: 100 }]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('appends the next page when loadMore resolves', async () => {
    fetchPrivateLeaderboard.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ user_id: 'u-1', total_score: 100 }],
        nextCursor: 'cursor-2',
        hasMore: true,
      },
    });
    fetchPrivateLeaderboardNext.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ user_id: 'u-2', total_score: 80 }],
        nextCursor: null,
        hasMore: false,
      },
    });

    const { result } = renderHook(
      () => usePrivateLeaderboard({ groupId: 'g-7', limit: 20 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.loadMore();

    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(fetchPrivateLeaderboardNext).toHaveBeenCalledWith(
      { token: TOKEN, userId: USER_ID },
      { groupId: 'g-7', after: 'cursor-2', limit: 20 }
    );
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('exposes the error payload and keeps isLoading false when the network fails', async () => {
    fetchPrivateLeaderboard.mockResolvedValue({
      status: 500,
      data: { error: 'boom' },
    });

    const { result } = renderHook(
      () => usePrivateLeaderboard({ groupId: 'g-7' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toEqual({ error: 'boom' });
  });

  it('does not emit a React state-update warning when refresh resolves after unmount', async () => {
    let resolveRefresh;
    fetchPrivateLeaderboard.mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(
      () => usePrivateLeaderboard({ groupId: 'g-7', limit: 20 }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      result.current.refresh();
    });

    unmount();

    await act(async () => {
      resolveRefresh({
        status: 200,
        data: { rows: [{ user_id: 'u-late', total_score: 1 }], nextCursor: null },
      });
    });

    const reactWarningCalls = consoleError.mock.calls.filter((args) =>
      typeof args[0] === 'string' && /state update on an unmounted component|Can't perform a React state update/i.test(args[0])
    );

    expect(reactWarningCalls).toHaveLength(0);

    consoleError.mockRestore();
  });
});
