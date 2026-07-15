import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchGroups } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

export function useGroupsHub({ enabled = true } = {}) {
  const { token, userId } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !token || !userId) {
      if (mounted.current) {
        setData(null);
        setError(null);
        setIsLoading(false);
      }
      return;
    }

    if (mounted.current) {
      setIsLoading(true);
      setError(null);
    }

    const response = await fetchGroups({ token, userId });

    if (!mounted.current) return;

    if (response?.status === 200) {
      setData(response.data);
    } else {
      setError(response?.data ?? response);
    }

    if (mounted.current) setIsLoading(false);
  }, [enabled, token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
