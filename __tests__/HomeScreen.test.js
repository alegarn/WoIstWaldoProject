jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('expo-screen-orientation', () => ({
  getOrientationAsync: jest.fn(),
  getOrientationLockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {
    PORTRAIT_UP: 'PORTRAIT_UP',
    LANDSCAPE_LEFT: 'LANDSCAPE_LEFT',
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: class File {},
  Directory: class Directory {},
  Paths: {
    document: 'file:///documents/',
    cache: 'file:///cache/',
  },
}));

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

import React from 'react';
import { Alert, ScrollView } from 'react-native';
import axios from 'axios';
import * as ScreenOrientation from 'expo-screen-orientation';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import HomeScreen from '../screens/HomeScreen';
import { AuthContext } from '../store/auth-context';

const WELCOME_MODAL_TEXT = /Welcome, do you want to do the tutorial/;
const QUICK_TUTORIAL_TITLE = 'How to play';

function renderHomeScreen({ contextOverrides = {}, routeParams = {} } = {}) {
  const contextValue = {
    token: 'Bearer persisted-token',
    userId: '42',
    scoreId: 'score-1',
    verifyIsLoggedIn: jest.fn().mockResolvedValue(true),
    logout: jest.fn(),
    isTutorialFinished: {},
    turnTutorialOn: jest.fn().mockResolvedValue(undefined),
    ...contextOverrides,
  };
  const navigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
  };

  const screen = render(
    <AuthContext.Provider value={contextValue}>
      <HomeScreen navigation={navigation} route={{ params: routeParams }} />
    </AuthContext.Provider>
  );

  return { ...screen, contextValue, navigation };
}

function revealTutorialOverlayActions(screen) {
  const overlayScroll = screen.UNSAFE_getByType(ScrollView);
  fireEvent.scroll(overlayScroll, {
    nativeEvent: {
      contentOffset: { y: 1000 },
      layoutMeasurement: { height: 600 },
      contentSize: { height: 600 },
    },
  });
}

function finishQuickTutorial(screen) {
  fireEvent.press(screen.getByTestId('tutorial.quick.skip'));
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    ScreenOrientation.getOrientationAsync.mockResolvedValue(1);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('logs the user out and warns that the session expired when the persisted session is no longer valid', async () => {
    axios.get.mockResolvedValue({ status: 401, data: {} });

    const { contextValue, navigation } = renderHomeScreen({
      contextOverrides: {
        verifyIsLoggedIn: jest.fn().mockResolvedValue(false),
      },
    });

    await waitFor(() => expect(contextValue.logout).toHaveBeenCalledTimes(1));

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('get_score_id'),
      expect.anything()
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error, your session has expired',
      'Any upload will not be possible. \nPlease re-log in first'
    );
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('routes the home actions to the hide, guess and ranking paths', async () => {
    const screen = renderHomeScreen();

    expect(screen.getByText('Hide Waldo')).toBeTruthy();
    expect(screen.getByText('Find Waldo')).toBeTruthy();
    expect(screen.getByText('Ranking')).toBeTruthy();

    fireEvent.press(screen.getByTestId('home.button.hide'));
    fireEvent.press(screen.getByTestId('home.button.guess'));
    fireEvent.press(screen.getByTestId('home.button.ranking'));

    expect(screen.navigation.navigate).toHaveBeenNthCalledWith(1, 'HidingPathScreen');
    expect(screen.navigation.navigate).toHaveBeenNthCalledWith(2, 'GuessPathScreen');
    expect(screen.navigation.navigate).toHaveBeenNthCalledWith(3, 'RankingScreen');
  });

  it('walks first-time users through the quick tutorial, then offers the full tutorial', async () => {
    const screen = renderHomeScreen({
      contextOverrides: {
        isTutorialFinished: {
          isTutorial: true,
          guessPathDone: false,
          hidePathDone: false,
        },
      },
    });

    expect(screen.getByText(QUICK_TUTORIAL_TITLE)).toBeTruthy();
    expect(screen.queryByText(WELCOME_MODAL_TEXT)).toBeNull();

    finishQuickTutorial(screen);

    expect(screen.queryByText(QUICK_TUTORIAL_TITLE)).toBeNull();
    expect(screen.getByText(WELCOME_MODAL_TEXT)).toBeTruthy();
  });

  it('cancelling the tutorial offer marks the tutorial as finished and closes the offer', async () => {
    axios.put.mockResolvedValue({ status: 200, data: {} });

    const screen = renderHomeScreen({
      contextOverrides: {
        isTutorialFinished: {
          isTutorial: true,
          guessPathDone: false,
          hidePathDone: false,
        },
      },
    });

    finishQuickTutorial(screen);

    fireEvent.press(screen.getByTestId('home.tutorial-modal.close'));

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('set_is_tutorial_finished'),
        expect.objectContaining({
          user: expect.objectContaining({
            is_tutorial_finished: true,
            user_id: '42',
          }),
        }),
        expect.anything()
      )
    );

    expect(screen.contextValue.turnTutorialOn).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByText(WELCOME_MODAL_TEXT)).toBeNull());
  });

  it('reopens the quick tutorial from the in-tutorial overlay without re-offering the full tutorial', async () => {
    const screen = renderHomeScreen({ routeParams: { tutorialToken: 1234 } });

    expect(screen.getByText(/Welcome to WoIstWaldo tutorial/)).toBeTruthy();

    revealTutorialOverlayActions(screen);

    fireEvent.press(screen.getByTestId('tutorial.overlay.quickBtn'));

    expect(screen.getByText(QUICK_TUTORIAL_TITLE)).toBeTruthy();

    finishQuickTutorial(screen);

    expect(screen.queryByText(QUICK_TUTORIAL_TITLE)).toBeNull();
    expect(screen.queryByText(WELCOME_MODAL_TEXT)).toBeNull();
    expect(screen.navigation.replace).not.toHaveBeenCalled();
  });

  it('routes the in-tutorial overlay to the guess and hide paths', async () => {
    const screen = renderHomeScreen({
      contextOverrides: {
        isTutorialFinished: {
          isTutorial: true,
          guessPathDone: false,
          hidePathDone: false,
        },
      },
      routeParams: { isTutorial: true },
    });

    revealTutorialOverlayActions(screen);

    fireEvent.press(screen.getByText('Hide the Waldo'));
    fireEvent.press(screen.getByText('Guess the Waldo'));

    expect(screen.navigation.replace).toHaveBeenNthCalledWith(1, 'HidingPathScreen', {
      isTutorial: true,
    });
    expect(screen.navigation.replace).toHaveBeenNthCalledWith(2, 'GuessPathScreen', {
      isTutorial: true,
    });
  });
});
