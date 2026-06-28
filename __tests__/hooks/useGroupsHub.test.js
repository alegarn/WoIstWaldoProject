import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useGroupsHub } from '../../hooks/useGroupsHub';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupApi', () => ({
  fetchGroups: jest.fn(),
}));

import { fetchGroups } from '../../services/groups/groupApi';

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

function makeWrapper(token = TOKEN, userId = USER_ID) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ token, userId }}>
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('useGroupsHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('populates data.owned and data.joined and flips isLoading to false once fetchGroups resolves', async () => {
    fetchGroups.mockResolvedValue({
      status: 200,
      data: {
        owned: [{ id: 'g-1', role: 'owner' }],
        joined: [{ id: 'g-2', role: 'member' }],
        pendingInvites: [],
      },
    });

    const { result } = renderHook(() => useGroupsHub(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchGroups).toHaveBeenCalledWith({ token: TOKEN, userId: USER_ID });
    expect(result.current.data.owned).toEqual([{ id: 'g-1', role: 'owner' }]);
    expect(result.current.data.joined).toEqual([{ id: 'g-2', role: 'member' }]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the API error payload and keeps isLoading false when fetchGroups fails', async () => {
    fetchGroups.mockResolvedValue({
      status: 500,
      data: { error: 'boom' },
    });

    const { result } = renderHook(() => useGroupsHub(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ error: 'boom' });
  });

  it('short-circuits to a null data state when auth context has no token', async () => {
    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper(null, USER_ID),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchGroups).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
