import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { ContextType } from 'react';

declare module '@react-native-async-storage/async-storage' {
  export const __store: Map<string, string>;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../helpers/statefulAsyncStorageMock')()
);

import AsyncStorage, { __store as asyncStorageStore } from '@react-native-async-storage/async-storage';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { getSnapshot, publish, resetGroupHubStore } from '../../services/groups/groupHubStore';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupApi', () => ({
  fetchGroups: jest.fn(),
}));

import { fetchGroups } from '../../services/groups/groupApi';
import type { GroupsResponse, RequestResult } from '../../services/groups/groupApi';
import type { GroupsHubData } from '../../types/groups';

type FetchGroupsResult = GroupsResponse | RequestResult;

const mockedFetchGroups = jest.mocked(fetchGroups);

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

const HUB: GroupsHubData = {
  owned: [{ id: 'g-1', role: 'owner' }],
  joined: [{ id: 'g-2', role: 'member' }],
  pendingInvites: [],
};

// Mutable auth value: mutate then rerender() to simulate credentials arriving.
function makeWrapper(auth: { token: string | null; userId: string | null }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider value={{ ...auth } as ContextType<typeof AuthContext>}>
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('useGroupsHub', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorageStore.clear();
    resetGroupHubStore();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
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
    mockedFetchGroups.mockResolvedValue({
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
    expect(result.current.data!.owned).toEqual([{ id: 'g-1', role: 'owner' }]);
    expect(result.current.data!.joined).toEqual([{ id: 'g-2', role: 'member' }]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the API error payload and keeps isLoading false when fetchGroups fails', async () => {
    mockedFetchGroups.mockResolvedValue({
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
    mockedFetchGroups.mockResolvedValue({ status: 200, data: HUB });

    const auth: { token: string | null; userId: string | null } = { token: null, userId: USER_ID };
    const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
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

    let resolveFetch!: (value: FetchGroupsResult) => void;
    mockedFetchGroups.mockReturnValueOnce(new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

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

    mockedFetchGroups.mockResolvedValue({ status: 500, data: { error: 'boom' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual({ error: 'boom' });
    expect(result.current.data).toEqual(HUB);
  });

  it('sets the thrown error but retains cached data and clears isLoading when fetchGroups rejects', async () => {
    jest.useFakeTimers();

    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    mockedFetchGroups.mockRejectedValue(new Error('non-axios crash'));

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
  });

  it('drops the previous user hub and hydrates the next user cache when identity changes', async () => {
    await AsyncStorage.setItem('groupsHub:user-2', JSON.stringify({ owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] }));

    mockedFetchGroups
      .mockResolvedValueOnce({ status: 200, data: HUB })
      .mockResolvedValue({
        status: 200,
        data: { owned: [{ id: 'g-2b' }], joined: [], pendingInvites: [] },
      });

    const auth = { token: TOKEN, userId: USER_ID };
    const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
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
    let resolveFetch!: (value: FetchGroupsResult) => void;
    mockedFetchGroups.mockImplementation(() => new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

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
    let resolveStale!: (value: FetchGroupsResult) => void;
    let resolveFresh!: (value: FetchGroupsResult) => void;
    mockedFetchGroups
      .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveStale = resolve; }))
      .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFresh = resolve; }));

    const auth = { token: TOKEN, userId: USER_ID };
    const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
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

  it('retries a transport-level failure (no status) within the 3-attempt budget and surfaces the success', async () => {
    mockedFetchGroups
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
    mockedFetchGroups.mockResolvedValue({ data: { message: 'Network Error' } });

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
  });

  it('succeeds on the second transport attempt without surfacing an error', async () => {
    jest.useFakeTimers();
    mockedFetchGroups
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
    mockedFetchGroups.mockResolvedValue({ data: { message: 'Network Error' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1600);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(3);
    expect(result.current.error).toEqual({ message: 'Network Error' });
    expect(result.current.isFresh).toBe(false);

    mockedFetchGroups.mockResolvedValue({ status: 200, data: HUB });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
  });

  it('marks isFresh false while cache-hydrated and true only after the 200 applies', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    let resolveFetch!: (value: FetchGroupsResult) => void;
    mockedFetchGroups.mockReturnValueOnce(new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

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
    let resolveRefresh!: (value: FetchGroupsResult) => void;
    mockedFetchGroups.mockReturnValueOnce(new Promise<FetchGroupsResult>((resolve) => {
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
      mockedFetchGroups.mockResolvedValue(REJECTED_RETURN);

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
    });

    it('heals a rejected payload from the store snapshot instead of surfacing the error', async () => {
      jest.useFakeTimers();

      publish(`${TOKEN}|${USER_ID}`, HUB);
      mockedFetchGroups.mockResolvedValue(REJECTED_RETURN);

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
    });

    it('does not publish a rejected payload to the shared hub store', async () => {
      jest.useFakeTimers();

      mockedFetchGroups.mockResolvedValue(REJECTED_RETURN);

      renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(getSnapshot()).toBeNull();
    });
  });

  describe('empty-200 guard', () => {
    const EMPTY = { owned: [], joined: [], pendingInvites: [] };

    it('applies a well-formed empty 200 immediately with no confirmation refetch or pending timers', async () => {
      jest.useFakeTimers();
      mockedFetchGroups.mockResolvedValue({ status: 200, data: EMPTY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(EMPTY);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(getSnapshot()).toEqual(expect.objectContaining({
        identityKey: `${TOKEN}|${USER_ID}`,
        data: EMPTY,
      }));
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(EMPTY));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(fetchGroups).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: false,
      }));
    });

    it('logs hadCachedData true and still applies the empty 200 immediately when prior rows existed', async () => {
      jest.useFakeTimers();

      await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));
      mockedFetchGroups.mockResolvedValue({ status: 200, data: EMPTY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(EMPTY);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.isLoading).toBe(false);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: true,
      }));
    });

    it('emits the raw-body diagnostic warn on an empty 200', async () => {
      jest.useFakeTimers();
      mockedFetchGroups.mockResolvedValue({
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
    });
  });

  describe('shared hub store integration', () => {
    it('shares one retried transport flight across concurrently mounted instances', async () => {
      jest.useFakeTimers();
      mockedFetchGroups
        .mockResolvedValueOnce({ data: { message: 'Network Error' } })
        .mockResolvedValue({ status: 200, data: HUB });

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(fetchGroups).toHaveBeenCalledTimes(2);

      expect(instanceA.result.current.data).toEqual(HUB);
      expect(instanceA.result.current.error).toBeNull();
      expect(instanceA.result.current.isLoading).toBe(false);
      expect(instanceA.result.current.isFresh).toBe(true);

      expect(instanceB.result.current.data).toEqual(HUB);
      expect(instanceB.result.current.error).toBeNull();
      expect(instanceB.result.current.isLoading).toBe(false);
      expect(instanceB.result.current.isFresh).toBe(true);
    });

    it('heals instances from a store publish that lands between mount and a non-200 shared-flight resolution', async () => {
      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups.mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(resolveFetch).toBeInstanceOf(Function);
      expect(fetchGroups).toHaveBeenCalledTimes(1);

      act(() => {
        publish(`${TOKEN}|${USER_ID}`, HUB);
      });

      await act(async () => {
        resolveFetch({ status: 401, data: { error: 'unauthorized' } });
      });

      expect(instanceA.result.current.data).toEqual(HUB);
      expect(instanceA.result.current.error).toBeNull();
      expect(instanceA.result.current.isLoading).toBe(false);

      expect(instanceB.result.current.data).toEqual(HUB);
      expect(instanceB.result.current.error).toBeNull();
      expect(instanceB.result.current.isLoading).toBe(false);
      expect(instanceB.result.current.isFresh).toBe(true);
    });

    it('still sets the error on a 4xx when the store has no matching snapshot', async () => {
      mockedFetchGroups.mockResolvedValue({ status: 401, data: { error: 'unauthorized' } });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual({ error: 'unauthorized' });
      expect(result.current.isFresh).toBe(false);
    });

    it('hydrates from the store snapshot synchronously on mount, before the cache and network', async () => {
      publish(`${TOKEN}|${USER_ID}`, HUB);

      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups.mockReturnValueOnce(new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

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
      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups.mockReturnValueOnce(new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

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

      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups
        .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }))
        .mockResolvedValueOnce({ status: 200, data: { owned: [{ id: 'g-2b-fresh' }], joined: [], pendingInvites: [] } });

      const auth = { token: TOKEN, userId: USER_ID };
      const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
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

  describe('cross-instance shared flight dedup', () => {
    it('collapses two concurrently mounted instances with the same identity into one fetchGroups call', async () => {
      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups.mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetchGroups).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFetch({ status: 200, data: HUB });
      });

      await waitFor(() => expect(instanceA.result.current.isLoading).toBe(false));
      await waitFor(() => expect(instanceB.result.current.isLoading).toBe(false));

      expect(instanceA.result.current.data).toEqual(HUB);
      expect(instanceA.result.current.isFresh).toBe(true);
      expect(instanceA.result.current.error).toBeNull();

      expect(instanceB.result.current.data).toEqual(HUB);
      expect(instanceB.result.current.isFresh).toBe(true);
      expect(instanceB.result.current.error).toBeNull();
    });

    it('starts a new shared flight when refreshing after the previous flight completed', async () => {
      mockedFetchGroups.mockResolvedValue({ status: 200, data: HUB });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(fetchGroups).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(fetchGroups).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(HUB);
      expect(result.current.isFresh).toBe(true);
    });

    it('never shares a flight across different identities', async () => {
      let resolveA!: (value: FetchGroupsResult) => void;
      let resolveB!: (value: FetchGroupsResult) => void;
      mockedFetchGroups
        .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveA = resolve; }))
        .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveB = resolve; }));

      const HUB_B: GroupsHubData = { owned: [{ id: 'g-b1' }], joined: [], pendingInvites: [] };

      const instanceA = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });
      const instanceB = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: 'Bearer token-2', userId: 'user-2' }),
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetchGroups).toHaveBeenCalledTimes(2);
      expect(fetchGroups).toHaveBeenCalledWith({ token: TOKEN, userId: USER_ID });
      expect(fetchGroups).toHaveBeenCalledWith({ token: 'Bearer token-2', userId: 'user-2' });

      await act(async () => {
        resolveA({ status: 200, data: HUB });
        resolveB({ status: 200, data: HUB_B });
      });

      await waitFor(() => expect(instanceA.result.current.data).toEqual(HUB));
      await waitFor(() => expect(instanceB.result.current.data).toEqual(HUB_B));

      expect(instanceA.result.current.isFresh).toBe(true);
      expect(instanceB.result.current.isFresh).toBe(true);
    });

    it('applies the joined outcome under the joiner own seq: a stale shared result never clobbers a newer flight', async () => {
      let resolveStale!: (value: FetchGroupsResult) => void;
      let resolveFresh!: (value: FetchGroupsResult) => void;
      mockedFetchGroups
        .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveStale = resolve; }))
        .mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFresh = resolve; }));

      const HUB2: GroupsHubData = { owned: [{ id: 'g-2x' }], joined: [], pendingInvites: [] };

      const auth = { token: TOKEN, userId: USER_ID };
      const wrapper = makeWrapper(auth);
      const instanceA = renderHook((_props: void) => useGroupsHub(), { wrapper });
      const instanceB = renderHook((_props: void) => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchGroups).toHaveBeenCalledTimes(1);
      expect(resolveStale).toBeInstanceOf(Function);

      auth.token = 'Bearer token-2';
      auth.userId = 'user-2';
      instanceA.rerender();
      instanceB.rerender();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(resolveFresh).toBeInstanceOf(Function);
      expect(fetchGroups).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveFresh({ status: 200, data: HUB2 });
      });

      await waitFor(() => expect(instanceA.result.current.data).toEqual(HUB2));
      await waitFor(() => expect(instanceB.result.current.data).toEqual(HUB2));

      await act(async () => {
        resolveStale({ status: 200, data: HUB });
      });

      expect(instanceA.result.current.data).toEqual(HUB2);
      expect(instanceB.result.current.data).toEqual(HUB2);
      expect(instanceA.result.current.error).toBeNull();
      expect(instanceB.result.current.error).toBeNull();
    });

    it('lets the joiner complete the shared flight after the starter unmounts mid-flight', async () => {
      let resolveFetch!: (value: FetchGroupsResult) => void;
      mockedFetchGroups.mockImplementationOnce(() => new Promise<FetchGroupsResult>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const starter = renderHook(() => useGroupsHub(), { wrapper });
      const joiner = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchGroups).toHaveBeenCalledTimes(1);

      starter.unmount();

      await act(async () => {
        resolveFetch({ status: 200, data: HUB });
      });

      await waitFor(() => expect(joiner.result.current.isLoading).toBe(false));

      expect(joiner.result.current.data).toEqual(HUB);
      expect(joiner.result.current.isFresh).toBe(true);
      expect(joiner.result.current.error).toBeNull();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(HUB));
    });
  });

  describe('hub cache write-diff', () => {
    it('writes the cache once when two identical accepted 200s land back-to-back', async () => {
      mockedFetchGroups.mockResolvedValue({ status: 200, data: HUB });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(fetchGroups).toHaveBeenCalledTimes(2);

      const cacheWrites = jest.mocked(AsyncStorage.setItem).mock.calls
        .filter(([key]) => key === 'groupsHub:user-1');
      expect(cacheWrites).toHaveLength(1);
      expect(cacheWrites[0][1]).toBe(JSON.stringify(HUB));
    });

    it('writes the cache again when the accepted payload changed since the last write', async () => {
      const HUB2: GroupsHubData = { owned: [{ id: 'g-9' }], joined: [], pendingInvites: [] };
      mockedFetchGroups
        .mockResolvedValueOnce({ status: 200, data: HUB })
        .mockResolvedValue({ status: 200, data: HUB2 });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(fetchGroups).toHaveBeenCalledTimes(2);

      const cacheWrites = jest.mocked(AsyncStorage.setItem).mock.calls
        .filter(([key]) => key === 'groupsHub:user-1');
      expect(cacheWrites).toHaveLength(2);
      expect(cacheWrites[1][1]).toBe(JSON.stringify(HUB2));
    });
  });
});
