const mockBigButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockUseGroupsHub = jest.fn();
const mockUseActiveGroup = jest.fn();
const mockUseFocusEffect = jest.fn();
const mockGetGroupsDetailSeen = jest.fn();
const mockSetGroupsDetailSeen = jest.fn();
const mockMarkIntroShownThisSession = jest.fn();
const mockHasIntroShownThisSession = jest.fn();
const mockResetGroupsIntroSessionForTests = jest.fn();
const mockGroupsTutorialModal = jest.fn();
let mockGroupsIntroEnabled = true;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => {
      mockUseFocusEffect(callback);
      callback();
    }, [callback]);
  },
}));

jest.mock('../../constants/featureFlags', () => ({
  get GROUPS_INTRO_ENABLED() {
    return mockGroupsIntroEnabled;
  },
}));

jest.mock('../../utils/storageDatum', () => ({
  getGroupsDetailSeen: () => mockGetGroupsDetailSeen(),
  setGroupsDetailSeen: (value) => mockSetGroupsDetailSeen(value),
}));

jest.mock('../../screens/Groups/groupsIntroSession', () => ({
  markIntroShownThisSession: () => mockMarkIntroShownThisSession(),
  hasIntroShownThisSession: () => mockHasIntroShownThisSession(),
  resetGroupsIntroSessionForTests: () => mockResetGroupsIntroSessionForTests(),
}));

jest.mock('../../components/UI/GroupsTutorialModal', () => {
  const React = require('react');
  return function MockGroupsTutorialModal(props) {
    mockGroupsTutorialModal(props);
    return props.visible ? React.createElement('View', { testID: 'groups-tutorial-modal-probe' }) : null;
  };
});

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';

import GroupsListScreen from '../../screens/Groups/GroupsListScreen';
import { AuthContext } from '../../store/auth-context';

describe('GroupsListScreen', () => {
  let lastScreenFactory = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockGroupsIntroEnabled = true;
    mockGetGroupsDetailSeen.mockReset().mockResolvedValue(false);
    mockSetGroupsDetailSeen.mockReset().mockResolvedValue(null);
    mockHasIntroShownThisSession.mockReset().mockReturnValue(false);
    mockResetGroupsIntroSessionForTests();
    lastScreenFactory = null;
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushAsync() {
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve));
    });
  }

  async function renderScreen({ authContext = {}, hubData = null, isLoading = false, error = null, setActive = jest.fn().mockResolvedValue({ status: 200 }) } = {}) {
    mockUseGroupsHub.mockReturnValue({
      data: hubData,
      isLoading,
      error,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    lastScreenFactory = () => (
      <AuthContext.Provider value={authContext}>
        <GroupsListScreen navigation={{ navigate: jest.fn() }} />
      </AuthContext.Provider>
    );

    let renderer;

    await act(async () => {
      renderer = create(lastScreenFactory());
      await Promise.resolve();
    });
    await flushAsync();

    return renderer;
  }

  async function updateHubData(renderer, { hubData, isLoading = false, error = null }) {
    mockUseGroupsHub.mockReturnValue({
      data: hubData,
      isLoading,
      error,
      refresh: jest.fn(),
    });

    await act(async () => {
      renderer.update(lastScreenFactory());
    });
    await flushAsync();
  }

  async function refocus(renderer) {
    const focusCallback = mockUseFocusEffect.mock.calls[mockUseFocusEffect.mock.calls.length - 1][0];
    await act(async () => {
      focusCallback();
    });
    await flushAsync();
  }

  function findVisibleTutorialProbe(renderer) {
    return renderer.root.findAll(node => node.props?.testID === 'groups-tutorial-modal-probe')[0];
  }

  it('renders the empty state with the groups-list.container and groups-list.empty testIDs when no groups', async () => {
    const renderer = await renderScreen({
      authContext: { paidTier: 1 },
      hubData: { owned: [], joined: [], pendingInvites: [] },
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.container' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'groups-list.empty' })).toBeTruthy();
  });

  it('always offers the create-group CTA regardless of tier or ownership (Fix A: gate removed)', async () => {
    const renderer = await renderScreen({
      authContext: { paidTier: 0 },
      hubData: { owned: [], joined: [], pendingInvites: [] },
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.button.create' })).toBeTruthy();

    const ownedRenderer = await renderScreen({
      authContext: { paidTier: 0 },
      hubData: {
        owned: [{ id: 'g-1', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
    });

    expect(ownedRenderer.root.findAllByProps({ testID: 'groups-list.button.create' })).toHaveLength(1);
  });

  it('renders the Store entry point for a tier-0 user and routes it to the paywall with intent=store', async () => {
    const navigation = { navigate: jest.fn() };
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [], joined: [], pendingInvites: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive: jest.fn().mockResolvedValue({ status: 200 }) });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 0 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'groups-list.button.create' })).toBeTruthy();

    const storeButton = renderer.root.findByProps({ testID: 'groups-list.button.store' });
    expect(storeButton).toBeTruthy();

    await act(async () => {
      storeButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { intent: 'store' });
  });

  it('calls setActive with the tapped group id and then navigates to PrivateHomeScreen with private scope', async () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn().mockResolvedValue({ status: 200 });

    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-7', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 2 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-list.button.open-g-7' }).props.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-7');
    expect(navigation.navigate).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-7' },
    });
  });

  it('surfaces an Alert and skips navigation when setActive rejects on openGroup', async () => {
    const navigation = { navigate: jest.fn() };
    const setActive = jest.fn().mockRejectedValue({
      response: { status: 422, data: { error: 'boom' } },
    });

    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-7', role: 'owner', name: 'Mine' }],
        joined: [],
        pendingInvites: [],
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive });

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ paidTier: 2 }}>
          <GroupsListScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-list.button.open-g-7' }).props.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-7');
    expect(Alert.alert).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  describe('intro tutorial (C-modal)', () => {
    const emptyHub = { owned: [], joined: [], pendingInvites: [] };

    it('renders the groups.empty.subtitle under the empty-state title', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 1 },
        hubData: emptyHub,
      });

      expect(renderer.root.findByProps({ testID: 'groups-list.empty' })).toBeTruthy();
      expect(
        renderer.root.findAll(node => node.props?.children === 'Free to join and free to create.').length
      ).toBeGreaterThan(0);
    });

    it('keeps join/create as BigButtons and renders the store entry as a text link outside BigButton', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      const bigButtonTestIDs = mockBigButton.mock.calls.map(call => call[0]?.testID);
      expect(bigButtonTestIDs).toContain('groups-list.button.join');
      expect(bigButtonTestIDs).toContain('groups-list.button.create');
      expect(bigButtonTestIDs).not.toContain('groups-list.button.store');

      expect(renderer.root.findByProps({ testID: 'groups-list.button.store' })).toBeTruthy();
    });

    it('fires C on the first focus when the hub is settled, error-free and membership-free', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeTruthy();
    });

    it('fires C when hub data settles after focus (cold store entry)', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: null,
        isLoading: true,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();

      await updateHubData(renderer, { hubData: emptyHub });

      expect(findVisibleTutorialProbe(renderer)).toBeTruthy();
    });

    it('writes groupsDetailSeen on actual display of C', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeTruthy();
      expect(mockSetGroupsDetailSeen).toHaveBeenCalledWith(true);
    });

    it('does not re-fire C on a second focus of the same visit', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeTruthy();
      expect(mockSetGroupsDetailSeen).toHaveBeenCalledTimes(1);

      const probeProps = mockGroupsTutorialModal.mock.calls[mockGroupsTutorialModal.mock.calls.length - 1][0];
      await act(async () => {
        probeProps.onDone();
      });
      await flushAsync();

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();

      await refocus(renderer);

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();
      expect(mockSetGroupsDetailSeen).toHaveBeenCalledTimes(1);
    });

    it('never fires C while the hub is loading', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: null,
        isLoading: true,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();
      expect(mockSetGroupsDetailSeen).not.toHaveBeenCalled();
    });

    it('never fires C when the hub errored', async () => {
      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: null,
        error: new Error('boom'),
      });

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();
      expect(mockSetGroupsDetailSeen).not.toHaveBeenCalled();
    });

    it('never fires C when membership rows exist (owned or joined)', async () => {
      const ownedRenderer = await renderScreen({
        authContext: { paidTier: 2 },
        hubData: { owned: [{ id: 'g-1', role: 'owner', name: 'Mine' }], joined: [], pendingInvites: [] },
      });

      expect(findVisibleTutorialProbe(ownedRenderer)).toBeFalsy();

      const joinedRenderer = await renderScreen({
        authContext: { paidTier: 2 },
        hubData: { owned: [], joined: [{ id: 'g-2', role: 'member', name: 'Theirs' }], pendingInvites: [] },
      });

      expect(findVisibleTutorialProbe(joinedRenderer)).toBeFalsy();
      expect(mockSetGroupsDetailSeen).not.toHaveBeenCalled();
    });

    it('never renders C when GROUPS_INTRO_ENABLED is false', async () => {
      mockGroupsIntroEnabled = false;

      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();
      expect(mockGroupsTutorialModal).not.toHaveBeenCalled();
      expect(mockSetGroupsDetailSeen).not.toHaveBeenCalled();
    });

    it('does not fire C when the intro sheet already showed this session', async () => {
      mockHasIntroShownThisSession.mockReturnValue(true);

      const renderer = await renderScreen({
        authContext: { paidTier: 0 },
        hubData: emptyHub,
      });

      expect(findVisibleTutorialProbe(renderer)).toBeFalsy();
      expect(mockSetGroupsDetailSeen).not.toHaveBeenCalled();
    });
  });
});
