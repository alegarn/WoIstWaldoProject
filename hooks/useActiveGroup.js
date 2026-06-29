import { useCallback, useContext, useMemo } from 'react';
import { setActiveGroup } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

export function useActiveGroup() {
  const {
    token,
    userId,
    activeGroupId,
    isPrivateMode,
    setActiveGroupId,
    setPrivateMode,
  } = useContext(AuthContext);

  const setActive = useCallback(async (groupId) => {
    const response = await setActiveGroup({ token, userId }, groupId ?? null);

    if (response?.status === 200 || response?.status === 204) {
      const nextGroupId = response?.data?.active_group_id ?? groupId ?? null;
      await setActiveGroupId(nextGroupId);
      await setPrivateMode(!!nextGroupId);
    }

    return response;
  }, [token, userId, setActiveGroupId, setPrivateMode]);

  const clear = useCallback(() => {
    setActiveGroup({ token, userId }, null).catch(() => {});
    setActiveGroupId(null);
    return setPrivateMode(false);
  }, [token, userId, setActiveGroupId, setPrivateMode]);

  const scope = useMemo(
    () => (isPrivateMode && activeGroupId)
      ? { kind: 'private', groupId: activeGroupId }
      : { kind: 'public' },
    [activeGroupId, isPrivateMode],
  );

  return { activeGroupId: activeGroupId ?? null, setActive, clear, scope };
}
