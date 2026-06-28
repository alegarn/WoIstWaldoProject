const mockButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockLanguageSelector = jest.fn(() => null);

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

jest.mock('../components/UI/LanguageSelector', () => {
  return function MockLanguageSelector(props) {
    mockLanguageSelector(props);
    return null;
  };
});

jest.mock('../utils/auth', () => ({
  updateUser: jest.fn(),
  deleteAccount: jest.fn(),
  checkSecureStoreItem: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getPreferredLanguage: jest.fn(),
  savePreferredLanguage: jest.fn(),
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
import { getPreferredLanguage, savePreferredLanguage } from '../utils/storageDatum';

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
    getPreferredLanguage.mockResolvedValue('en');
    savePreferredLanguage.mockResolvedValue(undefined);
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
    const matchingCalls = mockButton.mock.calls.filter(([props]) => props.testID === testID);
    return matchingCalls[matchingCalls.length - 1][0];
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

  it('renders the preferred language row with the expected testID and label', async () => {
    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'settings.input.preferred-language' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ children: 'Preferred language (for new enigmas):' })
    ).toBeTruthy();
  });

  it('loads the stored preferred language on mount and forwards it to the selector', async () => {
    getPreferredLanguage.mockResolvedValue('fr');

    await renderScreen();

    expect(getPreferredLanguage).toHaveBeenCalledTimes(1);
    const lastCall =
      mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(lastCall).toEqual(
      expect.objectContaining({
        value: 'fr',
        testIDPrefix: 'settings.input.preferred-language.selector',
      })
    );
  });

  it('persists the selected preferred language, updates the row, and shows a success alert', async () => {
    await renderScreen();

    const lastCall =
      mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    const onChange = lastCall.onChange;

    await act(async () => {
      onChange('de');
      await flushEffects();
    });

    expect(savePreferredLanguage).toHaveBeenCalledWith('de');
    const updatedCall =
      mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    expect(updatedCall.value).toBe('de');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Preferred language saved!',
      'Your preferred language for new enigmas is now: de'
    );
  });
});