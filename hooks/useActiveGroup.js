import { useCallback, useContext, useMemo } from 'react';
import { setActiveGroup } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

export function useActiveGroup() {
  const { token, userId, activeGroupId, setActiveGroupId } = useContext(AuthContext);

  const setActive = useCallback(async (groupId) => {
    const response = await setActiveGroup({ token, userId }, groupId ?? null);

    if (response?.status === 200 || response?.status === 204) {
      await setActiveGroupId(response?.data?.active_group_id ?? groupId ?? null);
    }

    return response;
  }, [token, userId, setActiveGroupId]);

  const clear = useCallback(() => {
    return setActiveGroupId(null);
  }, [setActiveGroupId]);

  const scope = useMemo(
    () => activeGroupId
      ? { kind: 'private', groupId: activeGroupId }
      : { kind: 'public' },
    [activeGroupId],
  );

  return { activeGroupId: activeGroupId ?? null, setActive, clear, scope };
}
