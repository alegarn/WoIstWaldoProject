import { useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchPrivateLeaderboard,
  fetchPrivateLeaderboardNext,
} from '../services/groups/groupLeaderboardApi';
import { AuthContext } from '../store/auth-context';

export function usePrivateLeaderboard({ groupId, limit } = {}) {
  const { token, userId } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetchPrivateLeaderboard(
      { token, userId },
      { groupId, limit },
    );

    if (response?.status === 200) {
      setRows(response.data.rows);
      setNextCursor(response.data.nextCursor);
    } else {
      setError(response?.data ?? response);
    }

    setIsLoading(false);
  }, [token, userId, groupId, limit]);

  const loadMore = useCallback(async () => {
    if (!groupId || !nextCursor) {
      return;
    }

    const response = await fetchPrivateLeaderboardNext(
      { token, userId },
      { groupId, after: nextCursor, limit },
    );

    if (response?.status === 200) {
      setRows((prev) => [...prev, ...response.data.rows]);
      setNextCursor(response.data.nextCursor);
    } else {
      setError(response?.data ?? response);
    }
  }, [token, userId, groupId, limit, nextCursor]);

  useEffect(() => {
    setRows([]);
    setNextCursor(null);
    setError(null);
    refresh();
  }, [refresh]);

  const hasMore = !!nextCursor;

  return { rows, isLoading, error, hasMore, loadMore, refresh };
}
