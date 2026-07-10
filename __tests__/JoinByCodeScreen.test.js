const mockButton = jest.fn(() => null);
const mockUseActiveGroup = jest.fn();

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../services/groups/groupJoinApi', () => ({
  joinByCode: jest.fn(),
}));

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';

import JoinByCodeScreen from '../screens/Groups/JoinByCodeScreen';
import { AuthContext } from '../store/auth-context';
import { joinByCode } from '../services/groups/groupJoinApi';

describe('JoinByCodeScreen', () => {
  let setActive;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    setActive = jest.fn().mockResolvedValue({ status: 200 });
    mockUseActiveGroup.mockReturnValue({ setActive });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen({ contextValue, navigation } = {}) {
    const authValue = contextValue || { token: 'Bearer token-1', userId: 'user-1' };
    const screenNavigation = navigation || {
      replace: jest.fn(),
      navigate: jest.fn(),
    };
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={authValue}>
          <JoinByCodeScreen navigation={screenNavigation} />
        </AuthContext.Provider>
      );
    });

    return { renderer, contextValue: authValue, navigation: screenNavigation };
  }

  function getSubmitButtonProps() {
    const matchingCalls = mockButton.mock.calls.filter(([props]) => props.testID === 'join-code.button.submit');
    return matchingCalls[matchingCalls.length - 1][0];
  }

  async function submitCode(renderer, code) {
    await act(async () => {
      renderer.root.findByProps({ testID: 'join-code.input.code' }).props.onChangeText(code);
    });

    await act(async () => {
      await getSubmitButtonProps().onPress();
      await flushEffects();
    });
  }

  it('maps a 422 unknown_code response to the unknown code message', async () => {
    joinByCode.mockResolvedValue({
      status: 422,
      data: {
        error: 'unknown_code',
      },
    });

    const { renderer, contextValue, navigation } = await renderScreen();

    await submitCode(renderer, '  ABC123  ');

    expect(joinByCode).toHaveBeenCalledWith(contextValue, 'ABC123');
    expect(renderer.root.findByProps({ testID: 'join-code.error' }).props.children).toBe('Unknown code.');
    expect(setActive).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('maps a 422 already_member response to the existing-member message', async () => {
    joinByCode.mockResolvedValue({
      status: 422,
      data: {
        reason: 'already_member',
      },
    });

    const { renderer, contextValue, navigation } = await renderScreen();

    await submitCode(renderer, 'GROUP42');

    expect(joinByCode).toHaveBeenCalledWith(contextValue, 'GROUP42');
    expect(renderer.root.findByProps({ testID: 'join-code.error' }).props.children).toBe(
      'You are already in this group.'
    );
    expect(setActive).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('activates the group and replaces navigation with private scope on success', async () => {
    joinByCode.mockResolvedValue({
      status: 201,
      data: {
        group_id: 'group-5',
      },
    });

    const { renderer, navigation } = await renderScreen();

    await submitCode(renderer, 'GROUP5');

    expect(setActive).toHaveBeenCalledWith('group-5');
    expect(navigation.replace).toHaveBeenCalledWith('PrivateHomeScreen', {
      scope: { kind: 'private', groupId: 'group-5' },
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('surfaces the join-code.error message and resets isSubmitting when joinByCode rejects', async () => {
    joinByCode.mockRejectedValue({ response: { status: 422, data: { error: 'boom' } } });

    const { renderer } = await renderScreen();

    await submitCode(renderer, 'BOOM422');

    expect(joinByCode).toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'join-code.error' }).props.children.length).toBeGreaterThan(0);
    expect(setActive).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'join-code.button.submit' })).toBeTruthy();
  });
});