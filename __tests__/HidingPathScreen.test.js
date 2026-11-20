const mockLogicalImagePicker = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('../components/Picture/LogicalImagePicker', () => {
  return function MockLogicalImagePicker(props) {
    mockLogicalImagePicker(props);
    return null;
  };
});

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import HidingPathScreen from '../screens/HideScreens/HidingPathScreen';

describe('HidingPathScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseActiveGroup.mockReturnValue({ scope: null, clear: jest.fn() });
    mockUseGroupsHub.mockReturnValue({ data: null, refresh: jest.fn() });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen(route = { params: {} }) {
    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
      setOptions: jest.fn(),
    };

    let renderer;
    await act(async () => {
      renderer = create(
        <HidingPathScreen navigation={navigation} route={route} />
      );
      await Promise.resolve();
    });

    return { renderer, navigation };
  }

  it('shows the lock alert once and goes back when the private group is locked', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', name: 'Waldos', role: 'owner', locked: true }],
        joined: [],
      },
      refresh: jest.fn(),
    });

    const { navigation } = await renderScreen({
      params: { scope: { kind: 'private', groupId: 'g-1' } },
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Group is locked',
      'New private games are paused until the owner renews the subscription or transfers ownership.'
    );
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('shows the lock alert and goes back when the locked group is resolved via activeScope only (no route scope param)', async () => {
    mockUseActiveGroup.mockReturnValue({
      scope: { kind: 'private', groupId: 'g-1' },
      clear: jest.fn(),
    });
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', name: 'Waldos', role: 'owner', locked: true }],
        joined: [],
      },
      refresh: jest.fn(),
    });

    const { navigation } = await renderScreen({ params: {} });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Group is locked',
      'New private games are paused until the owner renews the subscription or transfers ownership.'
    );
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('does not alert or go back when the private group is unlocked', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', name: 'Waldos', role: 'owner', locked: false }],
        joined: [],
      },
      refresh: jest.fn(),
    });

    const scope = { kind: 'private', groupId: 'g-1' };
    const { navigation } = await renderScreen({ params: { scope } });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();

    const pickerProps = mockLogicalImagePicker.mock.calls.map(([props]) => props).pop();
    expect(pickerProps.scope).toEqual(scope);
    expect(pickerProps.navigation).toBe(navigation);
  });

  it('does not alert when the scope is public', async () => {
    mockUseActiveGroup.mockReturnValue({ scope: null, clear: jest.fn() });

    const { navigation } = await renderScreen();

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(mockLogicalImagePicker).toHaveBeenCalled();
  });
});
