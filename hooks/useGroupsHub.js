import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchGroups } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

export function useGroupsHub() {
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
    if (!token || !userId) {
      if (mounted.current) {
        setData(null);
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
  }, [token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
