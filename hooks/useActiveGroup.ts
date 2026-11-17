import { useCallback, useContext, useMemo } from 'react';
import { setActiveGroup } from '../services/groups/groupApi';
import type { RequestResult } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';
import type { GroupScope } from '../types/groups';

// auth-context.js is untyped JS; pin the slice this hook reads/writes so the
// setters keep their sync (void) contract at this boundary.
type ActiveGroupContextSlice = {
  token: string | null;
  userId: string | null;
  activeGroupId: string | null;
  isPrivateMode: boolean;
  setActiveGroupId: (groupId: string | null) => void;
  setPrivateMode: (isPrivateMode: boolean) => void;
};

export type UseActiveGroupResult = {
  activeGroupId: string | null;
  setActive: (groupId: string | null) => Promise<RequestResult>;
  clear: () => void;
  scope: GroupScope;
};

export function useActiveGroup(): UseActiveGroupResult {
  const {
    token,
    userId,
    activeGroupId,
    isPrivateMode,
    setActiveGroupId,
    setPrivateMode,
  } = useContext(AuthContext) as ActiveGroupContextSlice;

  const setActive = useCallback(async (groupId: string | null): Promise<RequestResult> => {
    const response = await setActiveGroup({ token, userId }, groupId ?? null);

    if (response?.status !== 200 && response?.status !== 204) {
      throw response;
    }

    const nextGroupId = response?.data?.active_group_id ?? groupId ?? null;
    setActiveGroupId(nextGroupId);
    setPrivateMode(!!nextGroupId);

    return response;
  }, [token, userId, setActiveGroupId, setPrivateMode]);

  const clear = useCallback(() => {
    return setPrivateMode(false);
  }, [setPrivateMode]);

  const scope = useMemo<GroupScope>(
    () => (isPrivateMode && activeGroupId)
      ? { kind: 'private', groupId: activeGroupId }
      : { kind: 'public' },
    [activeGroupId, isPrivateMode],
  );

  return { activeGroupId: activeGroupId ?? null, setActive, clear, scope };
}
