const mockHomeCard = jest.fn(() => null);
const mockBigButton = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../../components/UI/HomeCard', () => {
  return function MockHomeCard(props) {
    mockHomeCard(props);
    return null;
  };
});

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import PrivateHomeScreen from '../../screens/Groups/PrivateHomeScreen';
import { handleOrientation } from '../../utils/orientation';

describe('PrivateHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderScreen({ scope = { kind: 'private', groupId: 'g-7' }, clear = jest.fn(), groupsData = { owned: [], joined: [] } } = {}) {
    mockUseActiveGroup.mockReturnValue({ scope, clear });
    mockUseGroupsHub.mockReturnValue({ data: groupsData, refresh: jest.fn() });

    let renderer;
    await act(async () => {
      renderer = create(
        <PrivateHomeScreen
          navigation={{ navigate: jest.fn(), setOptions: jest.fn() }}
          route={{ params: { scope } }}
        />
      );
      await Promise.resolve();
    });

    return renderer;
  }

  it('renders the active group name in private-home.title and shows the back-to-public button', async () => {
    const renderer = await renderScreen({
      scope: { kind: 'private', groupId: 'g-7' },
      groupsData: {
        owned: [{ id: 'g-7', name: 'Waldos Of The World', role: 'owner' }],
        joined: [],
      },
    });

    const titleNode = renderer.root.findByProps({ testID: 'private-home.title' });
    expect(titleNode.props.children).toBe('Waldos Of The World');
    expect(renderer.root.findByProps({ testID: 'private-home.button.back-to-public' })).toBeTruthy();
    expect(handleOrientation).toHaveBeenCalledWith('portrait');
  });

  it('clears the active scope and routes back to HomeScreen when the back-to-public button is pressed', async () => {
    const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
    const clear = jest.fn().mockResolvedValue(undefined);

    mockUseActiveGroup.mockReturnValue({
      scope: { kind: 'private', groupId: 'g-7' },
      clear,
    });
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-7', name: 'Waldos', role: 'owner' }], joined: [] },
      refresh: jest.fn(),
    });

    let renderer;
    await act(async () => {
      renderer = create(
        <PrivateHomeScreen
          navigation={navigation}
          route={{ params: { scope: { kind: 'private', groupId: 'g-7' } } }}
        />
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'private-home.button.back-to-public' }).props.onPress();
      await Promise.resolve();
    });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('HomeScreen');
  });
});
