import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { ContextType } from 'react';

declare module '@react-native-async-storage/async-storage' {
  export const __store: Map<string, string>;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../helpers/statefulAsyncStorageMock')()
);

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import AsyncStorage, { __store as asyncStorageStore } from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { getSnapshot, publish, resetGroupHubStore } from '../../services/groups/groupHubStore';
import { AuthContext } from '../../store/auth-context';
import type { GroupsHubData } from '../../types/groups';

const mockedAxiosGet = jest.mocked(axios.get);

const GROUPS_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/`;

const TOKEN = 'Bearer token-1';
const USER_ID = 'user-1';

// Wire-level groups rows as the Rails API serves them ({ data: [...] }
// envelope with owner_id); the real fetchGroups normalizes them into the hub
// shape (owner_id → role).
type AxiosPayload = { status: number; data: unknown };

function groupsPayload(status: number, rows: Array<Record<string, unknown>>): AxiosPayload {
  return { status, data: { data: rows } };
}

const SERVER_ROWS: Array<Record<string, unknown>> = [
  { id: 'g-1', owner_id: USER_ID },
  { id: 'g-2', owner_id: 'other-user' },
];

const HUB: GroupsHubData = {
  owned: [{ id: 'g-1', owner_id: USER_ID, role: 'owner' }],
  joined: [{ id: 'g-2', owner_id: 'other-user', role: 'member' }],
  pendingInvites: [],
};

const HUB_FRESH: GroupsHubData = {
  owned: [{ id: 'g-fresh', owner_id: USER_ID, role: 'owner' }],
  joined: [],
  pendingInvites: [],
};

const G2B_SERVER_ROWS = [{ id: 'g-2b', owner_id: 'user-2' }];
const G2B_HUB: GroupsHubData = {
  owned: [{ id: 'g-2b', owner_id: 'user-2', role: 'owner' }],
  joined: [],
  pendingInvites: [],
};

// Assert the transport seam received the private-groups URL with the auth
// header for the given call (1-indexed).
function expectGroupsRequest(callIndex: number, token: string) {
  expect(mockedAxiosGet).toHaveBeenNthCalledWith(
    callIndex,
    GROUPS_URL,
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: token, HTTP_AUTHORIZATION: token }),
    }),
  );
}

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

    expect(mockedAxiosGet).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('populates data.owned and data.joined and flips isLoading to false once the request resolves', async () => {
    mockedAxiosGet.mockResolvedValue(groupsPayload(200, SERVER_ROWS));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
    expectGroupsRequest(1, TOKEN);
    expect(result.current.data).toEqual(HUB);
    expect(result.current.error).toBeNull();
  });

  it('exposes the API error payload and keeps isLoading false when the groups request fails', async () => {
    mockedAxiosGet.mockResolvedValue({ status: 500, data: { error: 'boom' } });

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

    expect(mockedAxiosGet).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches and writes the hub cache once credentials arrive', async () => {
    mockedAxiosGet.mockResolvedValue(groupsPayload(200, SERVER_ROWS));

    const auth: { token: string | null; userId: string | null } = { token: null, userId: USER_ID };
    const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
      wrapper: makeWrapper(auth),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedAxiosGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    auth.token = TOKEN;
    rerender();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(HUB);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('groupsHub:user-1', JSON.stringify(HUB));
  });

  it('hydrates cached hub data before the network resolves (stale-while-revalidate)', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    let resolveFetch!: (payload: AxiosPayload) => void;
    mockedAxiosGet.mockReturnValueOnce(new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

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
      resolveFetch(groupsPayload(200, [{ id: 'g-fresh', owner_id: USER_ID }]));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(HUB_FRESH);
  });

  it('sets the error but retains cached data when the fetch fails', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    mockedAxiosGet.mockResolvedValue({ status: 500, data: { error: 'boom' } });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual({ error: 'boom' });
    expect(result.current.data).toEqual(HUB);
  });

  it('sets the error but retains cached data and clears isLoading when the transport crashes', async () => {
    jest.useFakeTimers();

    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    mockedAxiosGet.mockRejectedValue(new Error('non-axios crash'));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1600);
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(new Error('non-axios crash'));
    expect(result.current.data).toEqual(HUB);
  });

  it('drops the previous user hub and hydrates the next user cache when identity changes', async () => {
    await AsyncStorage.setItem('groupsHub:user-2', JSON.stringify(G2B_HUB));

    mockedAxiosGet
      .mockResolvedValueOnce(groupsPayload(200, SERVER_ROWS))
      .mockResolvedValue(groupsPayload(200, G2B_SERVER_ROWS));

    const auth = { token: TOKEN, userId: USER_ID };
    const { result, rerender } = renderHook((_props: void) => useGroupsHub(), {
      wrapper: makeWrapper(auth),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(HUB);

    auth.token = 'Bearer token-2';
    auth.userId = 'user-2';
    rerender();

    await waitFor(() => expect(result.current.data).toEqual(G2B_HUB));

    expectGroupsRequest(2, 'Bearer token-2');
  });

  it('single-flights concurrent mount and focus refresh calls into one request per identity', async () => {
    let resolveFetch!: (payload: AxiosPayload) => void;
    mockedAxiosGet.mockImplementation(() => new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

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

    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(groupsPayload(200, SERVER_ROWS));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(HUB);
  });

  it('ignores a stale flight failure that resolves after a newer identity flight succeeded', async () => {
    let resolveStale!: (payload: AxiosPayload) => void;
    let resolveFresh!: (payload: AxiosPayload) => void;
    mockedAxiosGet
      .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveStale = resolve; }))
      .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFresh = resolve; }));

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
      resolveFresh(groupsPayload(200, G2B_SERVER_ROWS));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(G2B_HUB);

    await act(async () => {
      resolveStale({ status: 500, data: { error: 'stale' } });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(G2B_HUB);
  });

  it('retries a transport-level failure (no status) within the 3-attempt budget and surfaces the success', async () => {
    mockedAxiosGet
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockResolvedValueOnce(groupsPayload(200, SERVER_ROWS));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
  });

  it('retries transport failures up to 3 attempts with backoff and surfaces the error only after the last attempt', async () => {
    jest.useFakeTimers();
    mockedAxiosGet.mockRejectedValue({ message: 'Network Error' });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(3);
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
    mockedAxiosGet
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockResolvedValueOnce(groupsPayload(200, SERVER_ROWS));

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces the error after all transport attempts fail and still allows manual retry', async () => {
    jest.useFakeTimers();
    mockedAxiosGet.mockRejectedValue({ message: 'Network Error' });

    const { result } = renderHook(() => useGroupsHub(), {
      wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1600);
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(3);
    expect(result.current.error).toEqual({ message: 'Network Error' });
    expect(result.current.isFresh).toBe(false);

    mockedAxiosGet.mockResolvedValue(groupsPayload(200, SERVER_ROWS));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(HUB);
  });

  it('marks isFresh false while cache-hydrated and true only after the 200 applies', async () => {
    await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));

    let resolveFetch!: (payload: AxiosPayload) => void;
    mockedAxiosGet.mockReturnValueOnce(new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

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
      resolveFetch(groupsPayload(200, SERVER_ROWS));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(HUB);
    expect(result.current.isFresh).toBe(true);
  });

  it('does not emit a React state-update warning when refresh resolves after unmount', async () => {
    let resolveRefresh!: (payload: AxiosPayload) => void;
    mockedAxiosGet.mockReturnValueOnce(new Promise<AxiosPayload>((resolve) => {
      resolveRefresh = resolve;
    }));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useGroupsHub(), { wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }) });

    await act(async () => {
      result.current.refresh();
    });

    unmount();

    await act(async () => {
      resolveRefresh(groupsPayload(200, [{ id: 'g-late', owner_id: USER_ID }]));
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

    it('surfaces the error state, not empty data, when a 200 wraps an error body', async () => {
      mockedAxiosGet.mockResolvedValue({ status: 200, data: ERROR_BODY });

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toEqual(ERROR_BODY);
      expect(result.current.data).toBeNull();
      expect(result.current.isFresh).toBe(false);
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('groupsHub:user-1', expect.any(String));

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] groups payload rejected', {
        bodySample: '{"status":404,"error":"Not Found","exception":"#<ActionController::RoutingError: No route matches>"}',
        rawType: 'object',
        bodyStatus: 404,
      });
      expect(warn).not.toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.anything());
    });

    it('heals a rejected payload from the store snapshot instead of surfacing the error', async () => {
      jest.useFakeTimers();

      publish(`${TOKEN}|${USER_ID}`, HUB);
      mockedAxiosGet.mockResolvedValue({ status: 200, data: ERROR_BODY });

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

      mockedAxiosGet.mockResolvedValue({ status: 200, data: ERROR_BODY });

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
      mockedAxiosGet.mockResolvedValue(groupsPayload(200, []));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
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
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: false,
      }));
    });

    it('logs hadCachedData true and still applies the empty 200 immediately when prior rows existed', async () => {
      jest.useFakeTimers();

      await AsyncStorage.setItem('groupsHub:user-1', JSON.stringify(HUB));
      mockedAxiosGet.mockResolvedValue(groupsPayload(200, []));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(EMPTY);
      expect(result.current.isFresh).toBe(true);
      expect(result.current.isLoading).toBe(false);

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', expect.objectContaining({
        hadCachedData: true,
      }));
    });

    it('emits the raw-body diagnostic warn on an empty 200', async () => {
      jest.useFakeTimers();
      mockedAxiosGet.mockResolvedValue(groupsPayload(200, []));

      renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(warn).toHaveBeenCalledWith('[useGroupsHub] 200 with empty groups payload', {
        hadCachedData: false,
        rawType: 'object',
        bodySample: '{"data":[]}',
      });
    });
  });

  describe('shared hub store integration', () => {
    it('shares one retried transport flight across concurrently mounted instances', async () => {
      jest.useFakeTimers();
      mockedAxiosGet
        .mockRejectedValueOnce({ message: 'Network Error' })
        .mockResolvedValue(groupsPayload(200, SERVER_ROWS));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);

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
      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet.mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(resolveFetch).toBeInstanceOf(Function);
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);

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
      mockedAxiosGet.mockResolvedValue({ status: 401, data: { error: 'unauthorized' } });

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

      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet.mockReturnValueOnce(new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

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
        resolveFetch(groupsPayload(200, [{ id: 'g-fresh', owner_id: USER_ID }]));
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual(HUB_FRESH);
    });

    it('ignores a publish for a different identity and adopts the matching one', async () => {
      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet.mockReturnValueOnce(new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

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
      publish('Bearer token-2|user-2', G2B_HUB);

      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet
        .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }))
        .mockResolvedValueOnce(groupsPayload(200, [{ id: 'g-2b-fresh', owner_id: 'user-2' }]));

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

      expect(result.current.data).toEqual(G2B_HUB);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveFetch(groupsPayload(200, [{ id: 'g-2b-stale', owner_id: 'user-2' }]));
        await jest.advanceTimersByTimeAsync(100);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({
        owned: [{ id: 'g-2b-fresh', owner_id: 'user-2', role: 'owner' }],
        joined: [],
        pendingInvites: [],
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('cross-instance shared flight dedup', () => {
    it('collapses two concurrently mounted instances with the same identity into one request', async () => {
      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet.mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const instanceA = renderHook(() => useGroupsHub(), { wrapper });
      const instanceB = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFetch(groupsPayload(200, SERVER_ROWS));
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
      mockedAxiosGet.mockResolvedValue(groupsPayload(200, SERVER_ROWS));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(HUB);
      expect(result.current.isFresh).toBe(true);
    });

    it('never shares a flight across different identities', async () => {
      let resolveA!: (payload: AxiosPayload) => void;
      let resolveB!: (payload: AxiosPayload) => void;
      mockedAxiosGet
        .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveA = resolve; }))
        .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveB = resolve; }));

      const HUB_B: GroupsHubData = {
        owned: [{ id: 'g-b1', owner_id: 'user-2', role: 'owner' }],
        joined: [],
        pendingInvites: [],
      };

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

      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
      expectGroupsRequest(1, TOKEN);
      expectGroupsRequest(2, 'Bearer token-2');

      await act(async () => {
        resolveA(groupsPayload(200, SERVER_ROWS));
        resolveB(groupsPayload(200, [{ id: 'g-b1', owner_id: 'user-2' }]));
      });

      await waitFor(() => expect(instanceA.result.current.data).toEqual(HUB));
      await waitFor(() => expect(instanceB.result.current.data).toEqual(HUB_B));

      expect(instanceA.result.current.isFresh).toBe(true);
      expect(instanceB.result.current.isFresh).toBe(true);
    });

    it('applies the joined outcome under the joiner own seq: a stale shared result never clobbers a newer flight', async () => {
      let resolveStale!: (payload: AxiosPayload) => void;
      let resolveFresh!: (payload: AxiosPayload) => void;
      mockedAxiosGet
        .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveStale = resolve; }))
        .mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFresh = resolve; }));

      const HUB2: GroupsHubData = {
        owned: [{ id: 'g-2x', owner_id: 'user-2', role: 'owner' }],
        joined: [],
        pendingInvites: [],
      };

      const auth = { token: TOKEN, userId: USER_ID };
      const wrapper = makeWrapper(auth);
      const instanceA = renderHook((_props: void) => useGroupsHub(), { wrapper });
      const instanceB = renderHook((_props: void) => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
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
      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveFresh(groupsPayload(200, [{ id: 'g-2x', owner_id: 'user-2' }]));
      });

      await waitFor(() => expect(instanceA.result.current.data).toEqual(HUB2));
      await waitFor(() => expect(instanceB.result.current.data).toEqual(HUB2));

      await act(async () => {
        resolveStale(groupsPayload(200, SERVER_ROWS));
      });

      expect(instanceA.result.current.data).toEqual(HUB2);
      expect(instanceB.result.current.data).toEqual(HUB2);
      expect(instanceA.result.current.error).toBeNull();
      expect(instanceB.result.current.error).toBeNull();
    });

    it('lets the joiner complete the shared flight after the starter unmounts mid-flight', async () => {
      let resolveFetch!: (payload: AxiosPayload) => void;
      mockedAxiosGet.mockImplementationOnce(() => new Promise<AxiosPayload>((resolve) => { resolveFetch = resolve; }));

      const wrapper = makeWrapper({ token: TOKEN, userId: USER_ID });
      const starter = renderHook(() => useGroupsHub(), { wrapper });
      const joiner = renderHook(() => useGroupsHub(), { wrapper });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);

      starter.unmount();

      await act(async () => {
        resolveFetch(groupsPayload(200, SERVER_ROWS));
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
      mockedAxiosGet.mockResolvedValue(groupsPayload(200, SERVER_ROWS));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);

      const cacheWrites = jest.mocked(AsyncStorage.setItem).mock.calls
        .filter(([key]) => key === 'groupsHub:user-1');
      expect(cacheWrites).toHaveLength(1);
      expect(cacheWrites[0][1]).toBe(JSON.stringify(HUB));
    });

    it('writes the cache again when the accepted payload changed since the last write', async () => {
      const HUB2: GroupsHubData = {
        owned: [{ id: 'g-9', owner_id: USER_ID, role: 'owner' }],
        joined: [],
        pendingInvites: [],
      };
      mockedAxiosGet
        .mockResolvedValueOnce(groupsPayload(200, SERVER_ROWS))
        .mockResolvedValue(groupsPayload(200, [{ id: 'g-9', owner_id: USER_ID }]));

      const { result } = renderHook(() => useGroupsHub(), {
        wrapper: makeWrapper({ token: TOKEN, userId: USER_ID }),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);

      const cacheWrites = jest.mocked(AsyncStorage.setItem).mock.calls
        .filter(([key]) => key === 'groupsHub:user-1');
      expect(cacheWrites).toHaveLength(2);
      expect(cacheWrites[1][1]).toBe(JSON.stringify(HUB2));
    });
  });
});
