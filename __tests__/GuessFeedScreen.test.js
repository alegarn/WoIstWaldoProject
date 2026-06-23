const mockSwipeImage = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const recordedScreens = [];

jest.mock('expo-dev-client', () => ({}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((payload) => ({ type: 'RESET', payload })),
  },
  DefaultTheme: {
    colors: {
      background: '#fff',
    },
  },
  NavigationContainer: ({ children }) => children,
  useNavigationContainerRef: jest.fn(() => ({
    isReady: jest.fn(() => false),
    getCurrentRoute: jest.fn(() => ({ name: 'HomeScreen' })),
    dispatch: jest.fn(),
  })),
}));

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');

  return {
    createNativeStackNavigator: jest.fn(() => ({
      Navigator: ({ children }) => <>{children}</>,
      Screen: (props) => {
        recordedScreens.push(props);
        return null;
      },
    })),
  };
});

jest.mock('../components/UI/SwipeImage', () => {
  return function MockSwipeImage(props) {
    mockSwipeImage(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../screens/AuthScreens/LoginScreen', () => 'LoginScreen');
jest.mock('../screens/AuthScreens/SignupScreen', () => 'SignupScreen');
jest.mock('../screens/HomeScreen', () => 'HomeScreen');
jest.mock('../screens/HideScreens/HidingPathScreen', () => 'HidingPathScreen');
jest.mock('../screens/HideScreens/HideScreen', () => 'HideScreen');
jest.mock('../screens/GuessScreens/GuessPathScreen', () => 'GuessPathScreen');
jest.mock('../screens/GuessScreens/GuessScreen', () => 'GuessScreen');
jest.mock('../screens/GuessScreens/AdScreen', () => 'AdScreen');
jest.mock('../screens/GuessScreens/ResultScreen', () => 'ResultScreen');
jest.mock('../screens/SetInstructionScreen', () => 'SetInstructionScreen');
jest.mock('../screens/RankingScreen', () => 'RankingScreen');
jest.mock('../screens/SettingsScreen', () => 'SettingsScreen');

jest.mock('../store/auth-context', () => {
  const React = require('react');
  const AuthContext = React.createContext({});

  return {
    __esModule: true,
    AuthContext,
    default: ({ children }) => children,
  };
});

jest.mock('../utils/auth', () => ({
  bootstrapStoredAuthSession: jest.fn(),
}));

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessFeedScreen from '../screens/GuessScreens/GuessFeedScreen';
import { Root } from '../App';
import { AuthContext } from '../store/auth-context';
import { bootstrapStoredAuthSession } from '../utils/auth';

describe('GuessFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
  });

  afterEach(() => {
    Dimensions.get.mockRestore();
  });

  function makeRoute(overrides = {}) {
    return {
      params: {
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        ...overrides,
      },
    };
  }

  it('renders SwipeImage with category and language derived from route params', async () => {
    const navigation = { replace: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();

    await act(async () => {
      create(<GuessFeedScreen navigation={navigation} route={route} />);
    });

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    const props = mockSwipeImage.mock.calls[0][0];
    expect(props.category).toEqual({ id: 'cat-1', key: 'nature' });
    expect(props.language).toBe('fr');
    expect(props.screenWidth).toBe(320);
    expect(props.screenHeight).toBe(640);
    expect(typeof props.startGuessing).toBe('function');
  });

  it('routes startGuessing to GuessScreen carrying the swiped item, route params, category, and language', async () => {
    const navigation = { replace: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ isTutorial: true });

    await act(async () => {
      create(<GuessFeedScreen navigation={navigation} route={route} />);
    });

    const { startGuessing } = mockSwipeImage.mock.calls[0][0];

    await act(async () => {
      startGuessing({
        item: {
          pictureId: 'img-1',
          imageFile: 'file:///waldo.jpg',
          listId: 7,
          description: 'Find Waldo',
        },
      });
    });

    expect(navigation.replace).toHaveBeenCalledWith('GuessScreen', {
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      isTutorial: true,
      pictureId: 'img-1',
      imageFile: 'file:///waldo.jpg',
      listId: 7,
      description: 'Find Waldo',
    });
  });

  it('continues to host SwipeImage in e2e mode so the saved-card stack renders', async () => {
    const navigation = { replace: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();

    await act(async () => {
      create(<GuessFeedScreen navigation={navigation} route={route} />);
    });

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    const props = mockSwipeImage.mock.calls[0][0];
    expect(props.category).toEqual({ id: 'cat-1', key: 'nature' });
    expect(props.language).toBe('fr');
    expect(typeof props.startGuessing).toBe('function');
  });
});

describe('GuessFeedScreen App header wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordedScreens.length = 0;
    bootstrapStoredAuthSession.mockResolvedValue(true);
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderRoot() {
    let renderer;

    const contextValue = {
      IsAuthenticated: true,
      isAuthenticated: true,
      restoreSession: jest.fn(),
      logout: jest.fn(),
    };

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <Root />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return renderer;
  }

  it('registers GuessFeedScreen with headerShown true and a back button calling navigation.goBack', async () => {
    await renderRoot();

    const registration = recordedScreens.find(({ name }) => name === 'GuessFeedScreen');
    expect(registration).toBeDefined();

    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const options = registration.options({ navigation });

    expect(options.presentation).toBe('modal');
    expect(options.headerShown).toBe(true);

    await act(async () => {
      create(options.headerLeft());
    });

    const backButton = mockIconButton.mock.calls
      .map(([props]) => props)
      .find((props) => props.testID === 'guess-feed.button.back');

    expect(backButton).toBeDefined();
    expect(backButton.icon).toBe('arrow-back');

    await act(async () => {
      backButton.onPress();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
