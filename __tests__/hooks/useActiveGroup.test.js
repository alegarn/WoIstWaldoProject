import { act, renderHook } from '@testing-library/react-native';
import React, { useState } from 'react';

import { useActiveGroup } from '../../hooks/useActiveGroup';
import { setActiveGroup } from '../../services/groups/groupApi';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupApi', () => ({
  setActiveGroup: jest.fn(),
}));

function ActiveGroupWrapper({ children, initialActiveGroupId, initialIsPrivateMode }) {
  const [activeGroupId, setActiveGroupId] = useState(initialActiveGroupId ?? null);
  const [isPrivateMode, setPrivateMode] = useState(initialIsPrivateMode ?? false);

  const value = {
    token: 'Bearer token-1',
    userId: 'user-1',
    activeGroupId,
    isPrivateMode,
    setActiveGroupId: async (next) => setActiveGroupId(next),
    setPrivateMode: async (next) => setPrivateMode(next),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

describe('useActiveGroup — scope derivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives {kind:"public"} initially', () => {
    const { result } = renderHook(() => useActiveGroup(), {
      wrapper: ({ children }) => (
        <ActiveGroupWrapper>{children}</ActiveGroupWrapper>
      ),
    });

    expect(result.current.scope).toEqual({ kind: 'public' });
  });

  it('derives {kind:"private", groupId} after setActive(id)', async () => {
    const response = {
      status: 200,
      data: { active_group_id: 'group-123' },
    };
    setActiveGroup.mockResolvedValue(response);

    const { result } = renderHook(() => useActiveGroup(), {
      wrapper: ({ children }) => (
        <ActiveGroupWrapper>{children}</ActiveGroupWrapper>
      ),
    });

    let returned;
    await act(async () => {
      returned = await result.current.setActive('group-123');
    });

    expect(setActiveGroup).toHaveBeenCalledWith(
      { token: 'Bearer token-1', userId: 'user-1' },
      'group-123'
    );
    expect(returned).toBe(response);
    expect(result.current.scope).toEqual({ kind: 'private', groupId: 'group-123' });
  });

  it('reverts to {kind:"public"} after clear() while retaining activeGroupId', async () => {
    setActiveGroup.mockResolvedValue({
      status: 200,
      data: { active_group_id: 'group-123' },
    });

    const { result } = renderHook(() => useActiveGroup(), {
      wrapper: ({ children }) => (
        <ActiveGroupWrapper>{children}</ActiveGroupWrapper>
      ),
    });

    await act(async () => {
      await result.current.setActive('group-123');
    });

    await act(async () => {
      await result.current.clear();
    });

    expect(setActiveGroup).toHaveBeenCalledTimes(1);
    expect(result.current.scope).toEqual({ kind: 'public' });
    expect(result.current.activeGroupId).toBe('group-123');
  });
});
