jest.mock('../services/groups/groupApi', () => ({
  setActiveGroup: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React, { useEffect, useState } from 'react';
import { act, create } from 'react-test-renderer';

import { useActiveGroup } from '../hooks/useActiveGroup';
import { setActiveGroup } from '../services/groups/groupApi';
import { AuthContext } from '../store/auth-context';

function ActiveGroupProbe({ onValue }) {
  const value = useActiveGroup();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

function ActiveGroupHarness({
  initialGroupId,
  initialPrivateMode,
  onValue,
  onSetActiveGroupId,
  onSetPrivateMode,
}) {
  const [activeGroupId, setActiveGroupIdState] = useState(initialGroupId);
  const [isPrivateMode, setPrivateModeState] = useState(initialPrivateMode);

  const contextValue = {
    token: 'Bearer token-1',
    userId: 'user-1',
    activeGroupId,
    isPrivateMode,
    setActiveGroupId: async (nextGroupId) => {
      onSetActiveGroupId(nextGroupId);
      setActiveGroupIdState(nextGroupId);
    },
    setPrivateMode: async (nextPrivateMode) => {
      onSetPrivateMode(nextPrivateMode);
      setPrivateModeState(nextPrivateMode);
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <ActiveGroupProbe onValue={onValue} />
    </AuthContext.Provider>
  );
}

describe('useActiveGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderHook({ initialGroupId, initialPrivateMode }) {
    let latestValue;
    const setActiveGroupIdCalls = [];
    const setPrivateModeCalls = [];

    await act(async () => {
      create(
        <ActiveGroupHarness
          initialGroupId={initialGroupId}
          initialPrivateMode={initialPrivateMode}
          onValue={(value) => {
            latestValue = value;
          }}
          onSetActiveGroupId={(nextGroupId) => {
            setActiveGroupIdCalls.push(nextGroupId);
          }}
          onSetPrivateMode={(nextPrivateMode) => {
            setPrivateModeCalls.push(nextPrivateMode);
          }}
        />
      );
    });

    return {
      getLatestValue: () => latestValue,
      setActiveGroupIdCalls,
      setPrivateModeCalls,
    };
  }

  it('clear() clears the active group both server-side and locally', async () => {
    setActiveGroup.mockResolvedValue({
      status: 204,
      data: { active_group_id: null },
    });

    const { getLatestValue, setActiveGroupIdCalls, setPrivateModeCalls } = await renderHook({
      initialGroupId: 'group-7',
      initialPrivateMode: true,
    });

    expect(getLatestValue().activeGroupId).toBe('group-7');
    expect(getLatestValue().scope).toEqual({ kind: 'private', groupId: 'group-7' });

    await act(async () => {
      await getLatestValue().clear();
    });

    expect(setActiveGroup).toHaveBeenCalledWith(
      { token: 'Bearer token-1', userId: 'user-1' },
      null
    );
    expect(setActiveGroupIdCalls).toEqual([null]);
    expect(setPrivateModeCalls).toEqual([false]);
    expect(getLatestValue().activeGroupId).toBeNull();
    expect(getLatestValue().scope).toEqual({ kind: 'public' });
  });

  it('updates the active group and private scope when activation succeeds', async () => {
    const response = {
      status: 200,
      data: {
        active_group_id: 'group-9',
      },
    };
    setActiveGroup.mockResolvedValue(response);

    const { getLatestValue, setActiveGroupIdCalls, setPrivateModeCalls } = await renderHook({
      initialGroupId: null,
      initialPrivateMode: false,
    });

    let result;

    await act(async () => {
      result = await getLatestValue().setActive('group-9');
    });

    expect(setActiveGroup).toHaveBeenCalledWith(
      { token: 'Bearer token-1', userId: 'user-1' },
      'group-9'
    );
    expect(setActiveGroupIdCalls).toEqual(['group-9']);
    expect(setPrivateModeCalls).toEqual([true]);
    expect(result).toBe(response);
    expect(getLatestValue().activeGroupId).toBe('group-9');
    expect(getLatestValue().scope).toEqual({ kind: 'private', groupId: 'group-9' });
  });
});