import { useCallback, useContext, useEffect, useState } from 'react';
import { fetchGroups } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

export function useGroupsHub() {
  const { token, userId } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token || !userId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetchGroups({ token, userId });

    if (response?.status === 200) {
      setData(response.data);
    } else {
      setError(response?.data ?? response);
    }

    setIsLoading(false);
  }, [token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
