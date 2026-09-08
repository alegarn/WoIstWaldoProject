import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  return {
    __esModule: true,
    __store: store,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store.has(key) ? store.get(key) : null)),
      setItem: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        store.delete(key);
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
      multiRemove: jest.fn((keys) => {
        for (const key of keys) store.delete(key);
        return Promise.resolve();
      }),
    },
  };
});

import AsyncStorage, { __store as asyncStorageStore } from '@react-native-async-storage/async-storage';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { getSnapshot, publish, resetGroupHubStore } from '../../services/groups/groupHubStore';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupApi', () => ({
  fetchGroups: jest.fn(),
}));

import { fetchGroups } from '../../services/groups/groupApi';

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

const HUB = {
  owned: [{ id: 'g-1', role: 'owner' }],
  joined: [{ id: 'g-2', role: 'member' }],
  pendingInvites: [],
};

// Mutable auth value: mutate then rerender() to simulate credentials arriving.
function makeWrapper(auth) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ ...auth }}>
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('useGroupsHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorageStore.clear();
    resetGroupHubStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not fetch private groups when disabled explicitly and keeps the pending loading state', async () => {
    const { result } = renderHook(() => useGroupsHub({ enabled: false }), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchGroups).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
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

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

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

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ error: 'boom' });
  });

  it('keeps the pending loading state and does not fetch when auth context has no token', async () => {
    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: null, userId: USER_ID }),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchGroups).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches and writes the hub cache once credentials arrive', async () => {
    fetchGroups.mockResolvedValue({ status: 200, data: HUB });

    const auth = { token: null, userId: USER_ID };
    const { result, rerender } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper(auth),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchGroups).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    auth.token = TOKEN;
    rerender();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchGroups).toHaveBeenCalledWith({ token: TOKEN, userId: USER_ID });
    expect(result.current.data).toEqual(HUB);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(HUB));
  });

  it('hydrates cached hub data before the network resolves (stale-while-revalidate)', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    let resolveFetch;
    fetchGroups.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(HUB);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFetch({ status: 200, data: { owned: [{ id: 'g-fresh' }], joined: [], pendingInvites: [] } });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ owned: [{ id: 'g-fresh' }], joined: [], pendingInvites: [] });
  });

  it('sets the error but retains cached data when the fetch fails', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    fetchGroups.mockResolvedValue({ status: 500, data: { error: 'boom' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual({ error: 'boom' });
    expect(result.current.data).toEqual(HUB);
  });

  it('sets the thrown error but retains cached data and clears isLoading when fetchGroups rejects', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    fetchGroups.mockRejectedValue(new Error('non-axios crash'));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1600);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(new Error('non-axios crash'));
    expect(result.current.data).toEqual(HUB);

    warn.mockRestore();
  });

  it('drops the previous user hub and hydrates the next user cache when identity changes', async () => {
    await AsyncStorage.setItem('groupsHub:user-2', JSON.stringify({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] }));

    fetchGroups
      .mockResolvedValueOnce({ status: 200, data: HUB })
      .mockResolvedValue({
        status: 200,
        data: { owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] },
      });

    const auth = { token: TOKEN, userId: USER_ID };
    const { result, rerender } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper(auth),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(HUB);

    auth.token = 'Bearer token-2';
    auth.userId = 'user-2';
    rerender();

    await waitFor(() => expect(result.current.data).toEqual({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] }));

    expect(fetchGroups).toHaveBeenCalledWith({ token: 'Bearer token-2', userId: 'user-2' });
  });

  it('single-flights concurrent mount and focus refresh calls into one fetch per identity', async () => {
    let resolveFetch;
    fetchGroups.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      result.current.refresh();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      result.current.refresh();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchGroups).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ status: 200, data: HUB });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(HUB);
  });

  it('ignores a stale flight failure that resolves after a newer identity flight succeeded', async () => {
    let resolveStale;
    let resolveFresh;
    fetchGroups
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFresh = resolve; }));

    const auth = { token: TOKEN, userId: USER_ID };
    const { result, rerender } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper(auth),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resolveStale).toBeInstanceOf(Function);

    auth.token = 'Bearer token-2';
    auth.userId = 'user-2';
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resolveFresh).toBeInstanceOf(Function);

    await act(async () => {
      resolveFresh({ status: 200, data: { owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] } });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] });

    await act(async () => {
      resolveStale({ status: 500, data: { error: 'stale' } });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] });
  });

  it('retries once automatically after a transport-level failure (no status) and surfaces the success', async () => {
    fetchGroups
      .mockResolvedValueOnce({ data: { message: 'Network Error' } })
      .mockResolvedValueOnce({ status: 200, data: HUB });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchGroups).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
  });

  it('retries transport failures up to 3 attempts with backoff and surfaces the error only after the last attempt', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchGroups.mockResolvedValue({ data: { message: 'Network Error' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual({ message: 'Network Error' });
    expect(result.current.isFresh).toBe(false);

    expect(warn).toHaveBeenCalledWith('[useGroupsHub] groups fetch failed', {
      status: null,
      message: 'Network Error',
      attempts: 3,
      identityKey: 'present',
    });

    warn.mockRestore();
  });

  it('succeeds on the second transport attempt without surfacing an error', async () => {
    jest.useFakeTimers();
    fetchGroups
      .mockResolvedValueOnce({ data: { message: 'Network Error' } })
      .mockResolvedValueOnce({ status: 200, data: HUB });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces the error after all transport attempts fail and still allows manual retry', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchGroups.mockResolvedValue({ data: { message: 'Network Error' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1600);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(3);
    expect(result.current.error).toEqual({ message: 'Network Error' });
    expect(result.current.isFresh).toBe(false);

    warn.mockRestore();

    fetchGroups.mockResolvedValue({ status: 200, data: HUB });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
  });

  it('marks isFresh false while cache-hydrated and true only after the 200 applies', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    let resolveFetch;
    fetchGroups.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(false);

    await act(async () => {
      resolveFetch({ status: 200, data: HUB });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
  });

  it('does not emit a React state-update warning when refresh resolves after unmount', async () => {
    let resolveRefresh;
    fetchGroups.mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useGroupsHub(), { wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }) });

    await act(async () => {
      result.current.refresh();
    });

    unmount();

    await act(async () => {
      resolveRefresh({
        status: 200,
        data: { owned: [{ id: 'g-late' }], joined: [], pendingInvites: [] },
      });
    });

    const reactWarningCalls = consoleError.mock.calls.filter((args) =>
      typeof args[0] === 'string' && /state update on an unmounted component|Can't perform a React state update/i.test(args[0])
    );

    expect(reactWarningCalls).toHaveLength(0);

    consoleError.mockRestore();
  });

  describe('invalid payload guard (carrier-200 error bodies)', () => {
    const ERROR_BODY = {
      status: 404,
      error: 'Not Found',
      exception: '#<ActionController::RoutingError: No route matches>',
    };

    const REJECTED_RETURN = {
      status: 404,
      data: ERROR_BODY,
      payloadInvalid: true,
      rawBodyType: 'object',
      rawBodySample: '{"status":404,"error":"Not Found","exception":"#<ActionController::RoutingError...',
    };

    it('surfaces the error state, not empty data, when a 200 wraps an error body', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchGroups.mockResolvedValue(REJECTED_RETURN);

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toEqual(ERROR_BODY);
      expect(result.current.data).toBeNull();
      expect(result.current.isFresh).toBe(false);
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('groupsHub:user-1', expect.any(String));

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] groups payload rejected', {
        bodySample: '{"status":404,"error":"Not Found","exception":"#<ActionController::RoutingError...',
        rawType: 'object',
        bodyStatus: 404,
      });
      expect(warn).not.toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.anything());

      warn.mockRestore();
    });

    it('heals a rejected payload from the store snapshot instead of surfacing the error', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      publish(`${TOKEN}|${USER_ID}`, HUB);
      fetchGroups.mockResolvedValue(REJECTED_RETURN);

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(result.current.data).toEqual(HUB);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFresh).toBe(true);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] groups payload rejected', expect.objectContaining({
        bodyStatus: 404,
      }));

      warn.mockRestore();
    });

    it('does not publish a rejected payload to the shared hub store', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      fetchGroups.mockResolvedValue(REJECTED_RETURN);

      renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(getSnapshot()).toBeNull();

      warn.mockRestore();
    });
  });

  describe('suspect empty-200 guard', () => {
    const EMPTY = { owned: [], joined: [], pendingInvites: [] };

    it('withholds a suspect empty 200 when rows exist, then applies the non-empty confirmation', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      fetchGroups
        .mockResolvedValueOnce({ status: 200, data: HUB })
        .mockResolvedValueOnce({
          status: 200,
          data: EMPTY,
          rawBodyType: 'object',
          rawBodySample: '{"data":[]}',
        })
        .mockResolvedValueOnce({ status: 200, data: { owned: [{ id: 'g-new' }], joined: [], pendingInvites: [] } });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(result.current.data).toEqual(HUB);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.data).toEqual(HUB);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(fetchGroups).toHaveBeenCalledTimes(2);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(3);
      expect(result.current.data).toEqual({ owned: [{ id: 'g-new' }], joined: [], pendingInvites: [] });
      expect(result.current.error).toBeNull();

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: true,
        rawType: 'object',
        bodySample: '{"data":[]}',
      }));

      warn.mockRestore();
    });

    it('accepts the empty payload when the confirmation refetch is also empty', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      fetchGroups
        .mockResolvedValueOnce({ status: 200, data: HUB })
        .mockResolvedValueOnce({ status: 200, data: EMPTY })
        .mockResolvedValue({ status: 200, data: EMPTY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(result.current.data).toEqual(HUB);

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.data).toEqual(HUB);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(3);
      expect(result.current.data).toEqual(EMPTY);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.error).toBeNull();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(EMPTY));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(fetchGroups).toHaveBeenCalledTimes(3);

      warn.mockRestore();
    });

    it('applies a first-ever empty 200 immediately without scheduling a confirmation', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchGroups.mockResolvedValue({ status: 200, data: EMPTY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(result.current.data).toEqual(EMPTY);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFresh).toBe(true);
      expect(fetchGroups).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(fetchGroups).toHaveBeenCalledTimes(1);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: false,
      }));

      warn.mockRestore();
    });

    it('does not write a withheld empty payload to the AsyncStorage hub cache', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));
      fetchGroups.mockResolvedValue({ status: 200, data: EMPTY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(result.current.data).toEqual(HUB);
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(EMPTY));
      expect(asyncStorageStore.get('groupsHub:user-1')).toBe(JSON.stringify(HUB));

      warn.mockRestore();
    });

    it('emits the raw-body diagnostic warn on an empty 200', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchGroups.mockResolvedValue({
        status: 200,
        data: EMPTY,
        rawBodyType: 'string',
        rawBodySample: '<html>gateway error</html>',
      });

      renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', {
        hadCachedData: false,
        rawType: 'string',
        bodySample: '<html>gateway error</html>',
      });

      warn.mockRestore();
    });
  });

  describe('shared hub store integration', () => {
    it('heals an instance whose fetch rejects at transport level from a sibling instance 200', async () => {
      jest.useFakeTimers();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchGroups
        .mockResolvedValueOnce({ status: 200, data: HUB })
        .mockRejectedValue(new Error('network down'));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(4);

      expect(instanceA.result.current.data).toEqual(HUB);
      expect(instanceA.result.current.error).toBeNull();
      expect(instanceA.result.current.isLoading).toBe(false);

      expect(instanceB.result.current.data).toEqual(HUB);
      expect(instanceB.result.current.error).toBeNull();
      expect(instanceB.result.current.isLoading).toBe(false);
      expect(instanceB.result.current.isFresh).toBe(true);

      warn.mockRestore();
    });

    it('heals a non-200 flight from a sibling 200 published between mount and the flight resolution', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let resolveSibling;
      let resolveOwn;
      fetchGroups
        .mockImplementationOnce(() => new Promise((resolve) => { resolveSibling = resolve; }))
        .mockImplementationOnce(() => new Promise((resolve) => { resolveOwn = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(resolveSibling).toBeInstanceOf(Function);
      expect(resolveOwn).toBeInstanceOf(Function);

      await act(async () => {
        resolveSibling({ status: 200, data: HUB });
      });

      await act(async () => {
        resolveOwn({ status: 401, data: { error: 'unauthorized' } });
      });

      expect(instanceB.result.current.data).toEqual(HUB);
      expect(instanceB.result.current.error).toBeNull();
      expect(instanceB.result.current.isLoading).toBe(false);
      expect(instanceB.result.current.isFresh).toBe(true);

      warn.mockRestore();
    });

    it('still sets the error on a 4xx when the store has no matching snapshot', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchGroups.mockResolvedValue({ status: 401, data: { error: 'unauthorized' } });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual({ error: 'unauthorized' });
      expect(result.current.isFresh).toBe(false);

      warn.mockRestore();
    });

    it('hydrates from the store snapshot synchronously on mount, before the cache and network', async () => {
      publish(`${TOKEN}|${USER_ID}`, HUB);

      let resolveFetch;
      fetchGroups.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      expect(result.current.data).toEqual(HUB);
      expect(result.current.error).toBeNull();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.data).toEqual(HUB);

      await act(async () => {
        resolveFetch({ status: 200, data: { owned: [{ id: 'g-fresh' }], joined: [], pendingInvites: [] } });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual({ owned: [{ id: 'g-fresh' }], joined: [], pendingInvites: [] });
    });

    it('ignores a publish for a different identity and adopts the matching one', async () => {
      let resolveFetch;
      fetchGroups.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.data).toBeNull();

      act(() => {
        publish('Bearer other-token|other-user', HUB);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      act(() => {
        publish(`${TOKEN}|${USER_ID}`, HUB);
      });

      expect(result.current.data).toEqual(HUB);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('hydrates the new identity from the store snapshot when the identity changes', async () => {
      jest.useFakeTimers();
      publish('Bearer token-2|user-2', { owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] });

      let resolveFetch;
      fetchGroups
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFetch = resolve; }))
        .mockResolvedValueOnce({ status: 200, data: { owned: [{ id: 'g-2b-fresh' }], joined: [], pendingInvites: [] } });

      const auth = { token: TOKEN, userId: USER_ID };
      const { result, rerender } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper(auth),
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.data).toBeNull();

      auth.token = 'Bearer token-2';
      auth.userId = 'user-2';
      rerender();

      expect(result.current.data).toEqual({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveFetch({ status: 200, data: { owned: [{ id: 'g-2b-stale' }], joined: [], pendingInvites: [] } });
        await jest.advanceTimersByTimeAsync(100);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({ owned: [{ id: 'g-2b-fresh' }], joined: [], pendingInvites: [] });
      expect(result.current.error).toBeNull();
    });
  });
});
