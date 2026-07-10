const mockButton = jest.fn(() => null);
const mockBigButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockUseGroupsHub = jest.fn();
const mockUseActiveGroup = jest.fn();

jest.mock('../../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
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

jest.mock('../../services/groups/groupApi', () => ({
  createGroup: jest.fn(),
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

import CreateGroupScreen from '../../screens/Groups/CreateGroupScreen';
import { AuthContext } from '../../store/auth-context';
import { createGroup } from '../../services/groups/groupApi';
import { DEFAULT_COLOR_PALETTE } from '../../components/UI/ColorPalettePicker';
import { generateShades } from '../../utils/colorShades';

// The screen's default values equal these base colors, so their derivative
// rows are auto-expanded on first render. Pick non-base shades to exercise a
// real selection change (tapping a base only expands, it does not select).
const PRIMARY_BASE = DEFAULT_COLOR_PALETTE[0];
const PRIMARY_SHADE = generateShades(PRIMARY_BASE.hex, 10)[1];
const PRIMARY_SHADE_TEST_ID = `create-group.color-primary.shade.${PRIMARY_BASE.hex.replace('#', '')}.${PRIMARY_SHADE.replace('#', '')}`;

const SECONDARY_BASE = DEFAULT_COLOR_PALETTE[1];
const SECONDARY_SHADE = generateShades(SECONDARY_BASE.hex, 10)[8];
const SECONDARY_SHADE_TEST_ID = `create-group.color-secondary.shade.${SECONDARY_BASE.hex.replace('#', '')}.${SECONDARY_SHADE.replace('#', '')}`;

describe('CreateGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [], joined: [], pendingInvites: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive: jest.fn() });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen({ authContext = {}, navigation = { replace: jest.fn(), navigate: jest.fn() } } = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={authContext}>
          <CreateGroupScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await Promise.resolve();
    });
    return { renderer, navigation };
  }

  it('renders the unlock CTA when the user premium tier is below 2 and routes to PaywallScreen on tap', async () => {
    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const { renderer } = await renderScreen({ authContext: { premiumTier: 1 }, navigation });

    expect(renderer.root.findByProps({ testID: 'create-group.button.unlock' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'create-group.button.unlock' }).props.onPress();
    });

    expect(navigation.replace).toHaveBeenCalledWith('PaywallScreen', { intent: 'create-group' });
  });

  it('keeps the user on the create form when premium tier >= 2 and submit calls createGroup with the entered payload', async () => {
    createGroup.mockResolvedValue({ status: 201, data: { id: 'g-new' } });
    const setActive = jest.fn().mockResolvedValue(undefined);
    mockUseActiveGroup.mockReturnValue({ setActive });

    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const { renderer } = await renderScreen({ authContext: { premiumTier: 2 }, navigation });

    expect(navigation.replace).not.toHaveBeenCalledWith('PaywallScreen', expect.anything());

    await act(async () => {
      renderer.root.findByProps({ testID: 'create-group.input.name' }).props.onChangeText('Waldos');
      renderer.root.findByProps({ testID: PRIMARY_SHADE_TEST_ID }).props.onPress();
      renderer.root.findByProps({ testID: SECONDARY_SHADE_TEST_ID }).props.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'create-group.button.submit' }).props.onPress();
      await Promise.resolve();
    });

    const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
    expect(modalProps.confirmTestID).toBe('create-group.confirm.ok');

    await act(async () => {
      await modalProps.onPress();
      await Promise.resolve();
    });

    expect(createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ premiumTier: 2 }),
      { name: 'Waldos', primaryColor: PRIMARY_SHADE, secondaryColor: SECONDARY_SHADE }
    );
    expect(setActive).toHaveBeenCalledWith('g-new');
    expect(navigation.replace).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-new' },
    });
  });

  it('surfaces an Alert and resets isSubmitting when createGroup rejects', async () => {
    createGroup.mockRejectedValue({ response: { status: 422, data: { error: 'boom' } } });

    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const { renderer } = await renderScreen({ authContext: { premiumTier: 2 }, navigation });

    await act(async () => {
      renderer.root.findByProps({ testID: 'create-group.input.name' }).props.onChangeText('Waldos');
      renderer.root.findByProps({ testID: PRIMARY_SHADE_TEST_ID }).props.onPress();
      renderer.root.findByProps({ testID: SECONDARY_SHADE_TEST_ID }).props.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'create-group.button.submit' }).props.onPress();
      await Promise.resolve();
    });

    const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
    expect(modalProps.confirmTestID).toBe('create-group.confirm.ok');

    await act(async () => {
      await modalProps.onPress();
      await Promise.resolve();
    });

    expect(Alert.alert).toHaveBeenCalled();

    expect(renderer.root.findByProps({ testID: 'create-group.button.submit' })).toBeTruthy();
  });

  it('shows the already-owns message without the unlock CTA when a Premium+ user owns a group', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-owned' }], joined: [], pendingInvites: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    const setActive = jest.fn().mockResolvedValue(undefined);
    mockUseActiveGroup.mockReturnValue({ setActive });

    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const { renderer } = await renderScreen({ authContext: { premiumTier: 2 }, navigation });

    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' })).toBeTruthy();

    expect(() =>
      renderer.root.findByProps({ testID: 'create-group.button.unlock' })
    ).toThrow();

    const goToGroupProps = renderer.root.findByProps({ testID: 'create-group.button.go-to-group' }).props;
    expect(goToGroupProps).toBeTruthy();

    await act(async () => {
      await goToGroupProps.onPress();
      await Promise.resolve();
    });

    expect(setActive).toHaveBeenCalledWith('g-owned');
    expect(navigation.replace).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'g-owned' },
    });
  });

  it('shows the already-owns message without the unlock CTA even when the user is not Premium+', async () => {
    mockUseGroupsHub.mockReturnValue({
      data: { owned: [{ id: 'g-owned' }], joined: [], pendingInvites: [] },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseActiveGroup.mockReturnValue({ setActive: jest.fn().mockResolvedValue(undefined) });

    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const { renderer } = await renderScreen({ authContext: { premiumTier: 0 }, navigation });

    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'create-group.message.already-owns' }).props.children).toBe('You can only create 1 group.');

    expect(() =>
      renderer.root.findByProps({ testID: 'create-group.button.unlock' })
    ).toThrow();
  });
});
