const mockButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../utils/auth', () => ({
  updateUser: jest.fn(),
  deleteAccount: jest.fn(),
  checkSecureStoreItem: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SettingsScreen from '../screens/SettingsScreen';
import { AuthContext } from '../store/auth-context';
import { checkSecureStoreItem, deleteAccount, updateUser } from '../utils/auth';

describe('SettingsScreen', () => {
  const contextValue = {
    changeUserEmail: jest.fn(),
    changeUsername: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    checkSecureStoreItem.mockImplementation(({ secureStoreValue }) => {
      if (secureStoreValue === 'email') {
        return Promise.resolve('stored@example.com');
      }

      if (secureStoreValue === 'username') {
        return Promise.resolve('stored-user');
      }

      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen() {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SettingsScreen />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return renderer;
  }

  function getButtonProps(testID) {
    return mockButton.mock.calls.find(([props]) => props.testID === testID)[0];
  }

  function getModalProps() {
    return mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
  }

  it('preloads the stored email and username into the form fields', async () => {
    const renderer = await renderScreen();

    expect(renderer.root.findByProps({ testID: 'settings.input.email' }).props.value).toBe('stored@example.com');
    expect(renderer.root.findByProps({ testID: 'settings.input.username' }).props.value).toBe('stored-user');
  });

  it('confirms and submits an email change through the modal flow', async () => {
    updateUser.mockResolvedValue({
      status: 200,
      data: {
        email: 'fresh@example.com',
      },
    });

    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'settings.input.email' }).props.onChangeText('new@example.com');
    });

    await act(async () => {
      getButtonProps('settings.button.save-email').onPress();
    });

    expect(getModalProps()).toEqual(
      expect.objectContaining({
        isModalVisible: true,
        children: 'Are you sure you want to change your email to new@example.com ?',
      })
    );

    await act(async () => {
      getModalProps().onPress();
      await flushEffects();
    });

    expect(updateUser).toHaveBeenCalledWith({
      context: contextValue,
      data: { email: 'new@example.com' },
    });
    expect(contextValue.changeUserEmail).toHaveBeenCalledWith('fresh@example.com');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Email changed successfully!',
      'Your new email is: fresh@example.com'
    );
  });

  it('confirms account deletion, logs the user out, and shows the success alert', async () => {
    deleteAccount.mockResolvedValue({
      status: 200,
      data: {
        message: 'Account removed.',
      },
    });

    await renderScreen();

    await act(async () => {
      getButtonProps('settings.button.delete-account').onPress();
    });

    expect(getModalProps().children).toContain('PERMANENT DELETION');

    await act(async () => {
      getModalProps().onPress();
      await flushEffects();
    });

    expect(deleteAccount).toHaveBeenCalledWith({ context: contextValue });
    expect(contextValue.logout).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Account deleted successfully!',
      'Account removed.\nWe are sorry to see you go!'
    );
  });
});