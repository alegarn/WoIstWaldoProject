// GroupsIntroGate RED suite (private-groups-intro-plan Task 4a).
//
// Pins the A-side Gate contract: completer/skipper arms, flag-write-before-
// visible ordering, silent membership double flag-write with a one-shot ref,
// ui-store reset on mount, 'active'-only + 'settle'-once publishes (never
// 'off' — the GroupsIconButton owns the tail), icon-tap dismiss-only
// (navigation belongs to the icon's own onPress),
// unsubscribe on unmount, one-shot zero-reads on refocus, and a single
// batched fail-open storage read. Suite-level RED on module resolution until
// components/Groups/GroupsIntroGate.tsx lands in 4b.

const mockUseGroupsHub = jest.fn();
const mockGroupsIntroSheet = jest.fn();
let mockUnsubscribe;
let mockUiState;
const mockUiListeners = new Set();

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

jest.mock('../../components/UI/GroupsIntroSheet', () => {
  const React = require('react');
  return function MockGroupsIntroSheet(props) {
    mockGroupsIntroSheet(props);
    return props.visible ? React.createElement('View', { testID: 'groups-intro.sheet-probe' }) : null;
  };
});

// In-file replica of the ui store: same latest+listeners semantics so the
// Gate's publish/reset/tap-diff behavior is observable through getUiState().
jest.mock('../../utils/groupsIntro/groupsIntroUiStore', () => ({
  getUiState: jest.fn(() => mockUiState),
  publish: jest.fn((patch) => {
    mockUiState = { ...mockUiState, ...patch };
    mockUiListeners.forEach((listener) => listener(mockUiState));
  }),
  subscribe: jest.fn((listener) => {
    mockUiListeners.add(listener);
    return mockUnsubscribe;
  }),
  signalIconTap: jest.fn(() => {
    mockUiState = { ...mockUiState, tapCount: mockUiState.tapCount + 1 };
    mockUiListeners.forEach((listener) => listener(mockUiState));
  }),
  resetGroupsIntroUiStoreForTests: jest.fn(() => {
    mockUiState = { ringPhase: 'off', tapCount: 0 };
    mockUiListeners.clear();
  }),
}));

jest.mock('../../utils/storageDatum', () => ({
  getGroupsIntroSeen: jest.fn(),
  setGroupsIntroSeen: jest.fn(),
  getGroupsDetailSeen: jest.fn(),
  setGroupsDetailSeen: jest.fn(),
  getAppOpenCount: jest.fn(),
  incrementAppOpenCount: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GroupsIntroGate from '../../components/Groups/GroupsIntroGate';
import { AuthContext } from '../../store/auth-context';
import {
  getAppOpenCount,
  getGroupsDetailSeen,
  getGroupsIntroSeen,
  setGroupsDetailSeen,
  setGroupsIntroSeen,
} from '../../utils/storageDatum';
import {
  getUiState,
  publish,
  signalIconTap,
  subscribe,
  resetGroupsIntroUiStoreForTests,
} from '../../utils/groupsIntro/groupsIntroUiStore';
import {
  hasIntroShownThisSession,
  resetGroupsIntroSessionForTests,
} from '../../screens/Groups/groupsIntroSession';

const EMPTY_HUB = { owned: [], joined: [], pendingInvites: [] };
const MEMBER_HUB = { owned: [{ id: 'g-1', role: 'owner', name: 'Mine' }], joined: [], pendingInvites: [] };
const NOT_IN_TUTORIAL = {};
const COMPLETED_TUTORIAL = { isTutorial: true, guessPathDone: true, hidePathDone: true };

describe('GroupsIntroGate', () => {
  function makeNavigation() {
    return { navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) };
  }

  async function flushAsync() {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }

  async function renderGate({
    chainQuiet = false,
    isTutorialFinished = NOT_IN_TUTORIAL,
    hub = EMPTY_HUB,
    isLoading = false,
    navigation = makeNavigation(),
  } = {}) {
    mockUseGroupsHub.mockReturnValue({
      data: hub,
      isLoading,
      error: null,
      isFresh: true,
      refresh: jest.fn(),
    });

    const element = (quiet) => (
      <AuthContext.Provider value={{ isTutorialFinished }}>
        <GroupsIntroGate chainQuiet={quiet} navigation={navigation} />
      </AuthContext.Provider>
    );

    let renderer;
    await act(async () => {
      renderer = create(element(chainQuiet));
      await Promise.resolve();
    });
    await flushAsync();

    return {
      renderer,
      navigation,
      goChainQuiet: async () => {
        await act(async () => {
          renderer.update(element(true));
        });
        await flushAsync();
      },
      updateHub: async (nextHub, nextIsLoading = false) => {
        mockUseGroupsHub.mockReturnValue({
          data: nextHub,
          isLoading: nextIsLoading,
          error: null,
          isFresh: true,
          refresh: jest.fn(),
        });
        await act(async () => {
          renderer.update(element(chainQuiet));
        });
        await flushAsync();
      },
    };
  }

  function sheetVisible(renderer) {
    return renderer.root.findAll((node) => node.props?.testID === 'groups-intro.sheet-probe').length > 0;
  }

  function sheetProps() {
    return mockGroupsIntroSheet.mock.calls[mockGroupsIntroSheet.mock.calls.length - 1]?.[0];
  }

  function listenerFor(navigation, event) {
    const call = navigation.addListener.mock.calls.find(([name]) => name === event);
    return call ? call[1] : null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    resetGroupsIntroUiStoreForTests();
    resetGroupsIntroSessionForTests();
    getGroupsIntroSeen.mockResolvedValue(false);
    setGroupsIntroSeen.mockResolvedValue(null);
    getGroupsDetailSeen.mockResolvedValue(false);
    setGroupsDetailSeen.mockResolvedValue(null);
    getAppOpenCount.mockResolvedValue(1);
  });

  it('fires the completer arm post-chain and writes the seen flag before the sheet becomes visible', async () => {
    let resolveSeenFlag;
    setGroupsIntroSeen.mockImplementation(
      () => new Promise((resolve) => {
        resolveSeenFlag = resolve;
      })
    );

    const { renderer, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    expect(sheetVisible(renderer)).toBe(false);
    expect(getGroupsIntroSeen).not.toHaveBeenCalled();

    await goChainQuiet();

    expect(getGroupsIntroSeen).toHaveBeenCalledTimes(1);
    expect(getAppOpenCount).toHaveBeenCalledTimes(1);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(sheetVisible(renderer)).toBe(false);

    await act(async () => {
      resolveSeenFlag();
    });
    await flushAsync();

    expect(sheetVisible(renderer)).toBe(true);
    expect(hasIntroShownThisSession()).toBe(true);
  });

  it('fires the skipper arm when appOpenCount is at least 2', async () => {
    getAppOpenCount.mockResolvedValue(2);

    const { renderer } = await renderGate({ chainQuiet: true });

    expect(sheetVisible(renderer)).toBe(true);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(hasIntroShownThisSession()).toBe(true);
  });

  it('stays inert with appOpenCount 1 and no Home blur', async () => {
    const { renderer } = await renderGate({ chainQuiet: true });

    expect(sheetVisible(renderer)).toBe(false);
    expect(setGroupsIntroSeen).not.toHaveBeenCalled();
  });

  it('fires on the first blur-focus cycle with appOpenCount 1, re-reading flags inside the focus callback', async () => {
    getGroupsIntroSeen.mockResolvedValue(true);

    const { renderer, navigation } = await renderGate({ chainQuiet: true });

    expect(sheetVisible(renderer)).toBe(false);

    getGroupsIntroSeen.mockResolvedValue(false);

    const onBlur = listenerFor(navigation, 'blur');
    const onFocus = listenerFor(navigation, 'focus');
    expect(typeof onBlur).toBe('function');
    expect(typeof onFocus).toBe('function');

    await act(async () => {
      onBlur();
    });
    await flushAsync();
    await act(async () => {
      onFocus();
    });
    await flushAsync();

    expect(sheetVisible(renderer)).toBe(true);
    expect(getGroupsIntroSeen.mock.calls.length).toBeGreaterThan(1);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
  });

  it('writes both seen flags silently for members exactly once across repeated settled loads', async () => {
    const { renderer, updateHub } = await renderGate({ hub: MEMBER_HUB });

    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(setGroupsDetailSeen).toHaveBeenCalledWith(true);
    expect(sheetVisible(renderer)).toBe(false);

    await updateHub(MEMBER_HUB);
    await updateHub({ owned: [], joined: [{ id: 'g-2', role: 'member', name: 'Theirs' }], pendingInvites: [] });

    expect(setGroupsIntroSeen).toHaveBeenCalledTimes(1);
    expect(setGroupsDetailSeen).toHaveBeenCalledTimes(1);
    expect(sheetVisible(renderer)).toBe(false);
  });

  it('resets the ui store ring phase to off on mount (no stale settle across sessions)', async () => {
    publish({ ringPhase: 'settle' });
    expect(getUiState().ringPhase).toBe('settle');

    const { renderer } = await renderGate({ chainQuiet: true });

    expect(getUiState().ringPhase).toBe('off');
    expect(sheetVisible(renderer)).toBe(false);
  });

  it("publishes ringPhase 'active' only when the sheet becomes visible (phase patches never resemble taps)", async () => {
    const { renderer, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    await goChainQuiet();

    expect(sheetVisible(renderer)).toBe(true);
    expect(getUiState()).toEqual({ ringPhase: 'active', tapCount: 0 });
  });

  it('unmounts the sheet on onLater and publishes settle exactly once (never off — the icon owns the tail)', async () => {
    const { renderer, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    await goChainQuiet();

    expect(sheetVisible(renderer)).toBe(true);
    expect(getUiState().ringPhase).toBe('active');

    const onLater = sheetProps().onLater;
    await act(async () => {
      onLater();
    });
    await flushAsync();

    expect(sheetVisible(renderer)).toBe(false);
    const settlePatches = publish.mock.calls.filter(([patch]) => patch.ringPhase === 'settle');
    expect(settlePatches).toHaveLength(1);
    expect(publish.mock.calls.some(([patch]) => patch.ringPhase === 'off')).toBe(false);
    expect(getUiState().ringPhase).toBe('settle');
  });

  it('closes the sheet without navigating when the icon tap signal fires while visible (icon owns navigation)', async () => {
    const { renderer, navigation, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    await goChainQuiet();
    expect(sheetVisible(renderer)).toBe(true);

    await act(async () => {
      signalIconTap();
    });
    await flushAsync();

    expect(getUiState().tapCount).toBe(1);
    expect(sheetVisible(renderer)).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('keeps the ring phase and subscription stable across navigation identity changes (mount-only reset)', async () => {
    const navigationA = makeNavigation();
    const navigationB = makeNavigation();
    mockUseGroupsHub.mockReturnValue({
      data: EMPTY_HUB,
      isLoading: false,
      error: null,
      isFresh: true,
      refresh: jest.fn(),
    });

    const gate = (navigation, quiet) => (
      <AuthContext.Provider value={{ isTutorialFinished: COMPLETED_TUTORIAL }}>
        <GroupsIntroGate chainQuiet={quiet} navigation={navigation} />
      </AuthContext.Provider>
    );

    let renderer;
    await act(async () => {
      renderer = create(gate(navigationA, false));
      await Promise.resolve();
    });
    await flushAsync();

    await act(async () => {
      renderer.update(gate(navigationB, true));
    });
    await flushAsync();

    expect(sheetVisible(renderer)).toBe(true);
    expect(getUiState().ringPhase).toBe('active');
    expect(publish.mock.calls.some(([patch]) => patch.ringPhase === 'off')).toBe(false);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('does not fire from a blur recorded while the chain was loud once the chain goes quiet', async () => {
    const { renderer, navigation, goChainQuiet } = await renderGate({ isTutorialFinished: NOT_IN_TUTORIAL });

    const onBlur = listenerFor(navigation, 'blur');
    const onFocus = listenerFor(navigation, 'focus');
    await act(async () => {
      onBlur();
      onFocus();
    });
    await flushAsync();

    expect(sheetVisible(renderer)).toBe(false);
    expect(setGroupsIntroSeen).not.toHaveBeenCalled();

    await goChainQuiet();

    expect(sheetVisible(renderer)).toBe(false);
    expect(setGroupsIntroSeen).not.toHaveBeenCalled();
  });

  it('unsubscribes from the ui store exactly once on unmount', async () => {
    const { renderer } = await renderGate({ chainQuiet: true });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('performs zero storage reads on refocus after the intro fired (one-shot ref guard)', async () => {
    const { renderer, navigation, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    await goChainQuiet();
    expect(sheetVisible(renderer)).toBe(true);

    const readsAfterFire = getGroupsIntroSeen.mock.calls.length + getAppOpenCount.mock.calls.length;
    expect(readsAfterFire).toBeGreaterThan(0);

    const onBlur = listenerFor(navigation, 'blur');
    const onFocus = listenerFor(navigation, 'focus');
    await act(async () => {
      onBlur();
    });
    await flushAsync();
    await act(async () => {
      onFocus();
    });
    await flushAsync();

    expect(getGroupsIntroSeen.mock.calls.length + getAppOpenCount.mock.calls.length).toBe(readsAfterFire);
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('issues storage reads as one batch and still evaluates when a read rejects (fail-open)', async () => {
    getAppOpenCount.mockRejectedValue(new Error('storage unavailable'));

    const { renderer, goChainQuiet } = await renderGate({ isTutorialFinished: COMPLETED_TUTORIAL });

    await goChainQuiet();

    expect(getGroupsIntroSeen).toHaveBeenCalledTimes(1);
    expect(getAppOpenCount).toHaveBeenCalledTimes(1);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('treats an in-flight hub as not-ready: no sheet, no reads, no writes until it settles as member (silent double flag-write only)', async () => {
    getAppOpenCount.mockResolvedValue(2);

    const { renderer, updateHub } = await renderGate({ chainQuiet: true, hub: null, isLoading: true });

    expect(sheetVisible(renderer)).toBe(false);
    expect(getGroupsIntroSeen).not.toHaveBeenCalled();
    expect(getAppOpenCount).not.toHaveBeenCalled();
    expect(setGroupsIntroSeen).not.toHaveBeenCalled();
    expect(setGroupsDetailSeen).not.toHaveBeenCalled();

    await updateHub(MEMBER_HUB);

    expect(sheetVisible(renderer)).toBe(false);
    expect(setGroupsIntroSeen).toHaveBeenCalledTimes(1);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(setGroupsDetailSeen).toHaveBeenCalledTimes(1);
    expect(setGroupsDetailSeen).toHaveBeenCalledWith(true);
  });

  it('fires the skipper sheet once only after an in-flight hub settles to non-member', async () => {
    getAppOpenCount.mockResolvedValue(2);

    const { renderer, updateHub } = await renderGate({ chainQuiet: true, hub: null, isLoading: true });

    expect(sheetVisible(renderer)).toBe(false);
    expect(getGroupsIntroSeen).not.toHaveBeenCalled();

    await updateHub(EMPTY_HUB);

    expect(sheetVisible(renderer)).toBe(true);
    expect(setGroupsIntroSeen).toHaveBeenCalledWith(true);
    expect(getGroupsIntroSeen).toHaveBeenCalledTimes(1);

    const readsAfterFire = getGroupsIntroSeen.mock.calls.length;
    await updateHub(EMPTY_HUB);
    expect(getGroupsIntroSeen.mock.calls.length).toBe(readsAfterFire);
    expect(sheetVisible(renderer)).toBe(true);
  });
});
