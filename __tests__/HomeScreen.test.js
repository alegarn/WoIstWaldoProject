const mockBigButton = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../utils/auth', () => ({
  getScoreId: jest.fn(),
}));

jest.mock('../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../utils/tutorialHandler', () => ({
  isTutorialFinished: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

jest.mock('../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import HomeScreen from '../screens/HomeScreen';
import { AuthContext } from '../store/auth-context';
import { getScoreId } from '../utils/auth';
import { isTutorialFinished } from '../utils/tutorialHandler';

describe('HomeScreen post-launch session validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function renderScreen(contextValue, route = { params: {} }, navigationOverrides = {}) {
    const navigation = {
      navigate: jest.fn(),
      replace: jest.fn(),
      reset: jest.fn(),
      ...navigationOverrides,
    };

    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <HomeScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    return navigation;
  }

  function getBigButtonProps(text) {
    const buttonCall = mockBigButton.mock.calls.find(([props]) => props.text === text);
    return buttonCall?.[0];
  }

  it('validates the persisted session on focus when verifyIsLoggedIn resolves false', async () => {
    getScoreId.mockResolvedValue({ status: 401 });

    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(false),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {},
    };

    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <HomeScreen navigation={{ navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() }} route={{ params: {} }} />
        </AuthContext.Provider>
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(contextValue.verifyIsLoggedIn).toHaveBeenCalledTimes(1);
    expect(getScoreId).toHaveBeenCalledWith(contextValue);
    expect(contextValue.logout).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error, your session has expired',
      'Any upload will not be possible. \nPlease re-log in first'
    );
  });

  it('routes the main home actions to their navigation targets', async () => {
    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(true),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {},
    };
    const navigation = await renderScreen(contextValue);

    getBigButtonProps('Hide Waldo').onPress();
    getBigButtonProps('Find Waldo').onPress();
    getBigButtonProps('Ranking').onPress();

    expect(navigation.navigate).toHaveBeenNthCalledWith(1, 'HidingPathScreen');
    expect(navigation.navigate).toHaveBeenNthCalledWith(2, 'GuessPathScreen');
    expect(navigation.navigate).toHaveBeenNthCalledWith(3, 'RankingScreen');
  });

  it('opens the tutorial modal when the context says the tutorial still needs to run', async () => {
    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(true),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {
        isTutorial: true,
        guessPathDone: false,
        hidePathDone: false,
      },
      turnTutorialOn: jest.fn(),
    };

    await renderScreen(contextValue);

    expect(mockCenteredModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isModalVisible: true,
      })
    );
  });

  it('cancels the tutorial through the modal and persists the finished flag', async () => {
    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(true),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {
        isTutorial: true,
        guessPathDone: false,
        hidePathDone: false,
      },
      turnTutorialOn: jest.fn().mockResolvedValue(undefined),
    };

    await renderScreen(contextValue);

    const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];

    await act(async () => {
      await modalProps.onCancel();
    });

    expect(contextValue.turnTutorialOn).toHaveBeenCalledWith(false);
    expect(isTutorialFinished).toHaveBeenCalledWith({
      context: contextValue,
      data: {
        user: {
          is_tutorial_finished: true,
        },
      },
    });
  });

  it('shows the tutorial overlay and routes its Guess/Hide actions when already inside the tutorial', async () => {
    const contextValue = {
      verifyIsLoggedIn: jest.fn().mockResolvedValue(true),
      logout: jest.fn(),
      token: 'Bearer persisted-token',
      isTutorialFinished: {
        isTutorial: true,
        guessPathDone: false,
        hidePathDone: false,
      },
      turnTutorialOn: jest.fn(),
    };
    const navigation = await renderScreen(contextValue, { params: { isTutorial: true } });

    const overlayProps = mockTutorialOverlay.mock.calls[mockTutorialOverlay.mock.calls.length - 1][0];

    overlayProps.onPress.Guess();
    overlayProps.onPress.Hide();

    expect(navigation.replace).toHaveBeenNthCalledWith(1, 'GuessPathScreen', { isTutorial: true });
    expect(navigation.replace).toHaveBeenNthCalledWith(2, 'HidingPathScreen', { isTutorial: true });
  });
});