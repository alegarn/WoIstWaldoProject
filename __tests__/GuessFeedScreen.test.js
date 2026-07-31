const mockSwipeImage = jest.fn(() => null);
const mockSwipeInstructions = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const recordedScreens = [];

jest.mock('expo-dev-client', () => ({}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
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
    useFocusEffect: (callback) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

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

jest.mock('../components/Instructions/SwipeInstructions', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return function MockSwipeInstructions({ handleFilterClick, screenWidth }) {
    mockSwipeInstructions({ handleFilterClick, screenWidth });
    return <Pressable testID="guess-feed.stub.start-swipe" onPress={handleFilterClick} />;
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
    useAuthContext: () => React.useContext(AuthContext),
  };
});

jest.mock('../utils/auth', () => ({
  bootstrapStoredAuthSession: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getOnboardingCompleted: jest.fn(),
  getSessionLanguageFilter: jest.fn(),
  saveSessionLanguageFilter: jest.fn(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: () => ({ data: null, isLoading: false, error: null, refresh: jest.fn() }),
}));

jest.mock('../hooks/useFlushOnLeave', () => ({
  useFlushOnLeave: () => {},
}));

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessFeedScreen from '../screens/GuessScreens/GuessFeedScreen';
import { Root } from '../App';
import { AuthContext } from '../store/auth-context';
import { bootstrapStoredAuthSession } from '../utils/auth';
import {
  getOnboardingCompleted,
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../utils/storageDatum';

describe('GuessFeedScreen', () => {
  const mountedRenderers = [];

  beforeEach(() => {
    jest.clearAllMocks();
    getOnboardingCompleted.mockResolvedValue(true);
    getSessionLanguageFilter.mockResolvedValue('fr');
    saveSessionLanguageFilter.mockResolvedValue(undefined);
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
  });

  afterEach(async () => {
    await act(async () => {
      mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
    });

    Dimensions.get.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  function createDeferred() {
    let resolve;
    const promise = new Promise((promiseResolve) => {
      resolve = promiseResolve;
    });

    return { promise, resolve };
  }

  function makeRoute(overrides = {}) {
    return {
      params: {
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        ...overrides,
      },
    };
  }

  function dismissSwipeInstructions(renderer) {
    act(() => {
      renderer.root.findByProps({ testID: 'guess-feed.stub.start-swipe' }).props.onPress();
    });
  }

  async function renderScreen(navigation, route) {
    let renderer;

    await act(async () => {
      renderer = create(<GuessFeedScreen navigation={navigation} route={route} />);
      await flushEffects();
    });

    mountedRenderers.push(renderer);

    return renderer;
  }

  it('prefers explicit route language over stored session filter on mount', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: 'de' });
    const renderer = await renderScreen(navigation, route);

    expect(mockSwipeInstructions).toHaveBeenCalledTimes(1);
    expect(mockSwipeInstructions.mock.calls[0][0].screenWidth).toBe(320);
    expect(mockSwipeImage).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('de');

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    const props = mockSwipeImage.mock.calls[0][0];
    expect(props.category).toEqual({ id: 'cat-1', key: 'nature' });
    expect(props.language).toBe('de');
    expect(props.screenWidth).toBe(320);
    expect(props.screenHeight).toBe(640);
    expect(typeof props.startGuessing).toBe('function');
    expect(typeof props.onOpenFilter).toBe('function');
    expect(getSessionLanguageFilter).not.toHaveBeenCalled();
  });

  it('falls back to stored session filter when route does not provide language', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: undefined });
    const deferredLanguage = createDeferred();

    getSessionLanguageFilter.mockReturnValue(deferredLanguage.promise);

    const renderer = await renderScreen(navigation, route);

    expect(mockSwipeImage).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('en');

    await act(async () => {
      deferredLanguage.resolve('fr');
      await flushEffects();
    });

    expect(getSessionLanguageFilter).toHaveBeenCalledTimes(1);
    expect(mockSwipeInstructions).toHaveBeenCalledTimes(1);
    expect(mockSwipeImage).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('fr');

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage.mock.calls[mockSwipeImage.mock.calls.length - 1][0].language).toBe('fr');
  });

  it('routes startGuessing to GuessScreen carrying the swiped item, route params, category, and language', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({
      isTutorial: true,
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 6 },
    });

    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    const { startGuessing } = mockSwipeImage.mock.calls[0][0];

    await act(async () => {
      startGuessing({
        item: {
          pictureId: 'img-1',
          imageFile: 'file:///waldo.jpg',
          listId: 7,
          description: 'Find Waldo',
          touchLocation: { x: 0.5, y: 0.5 },
        },
      });
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessScreen', {
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      isTutorial: true,
      scope: { kind: 'private', groupId: 'g-1' },
      activeGroup: { isOwnedByViewer: true, memberCount: 6 },
      pictureId: 'img-1',
      imageFile: 'file:///waldo.jpg',
      listId: 7,
      description: 'Find Waldo',
      touchLocation: { x: 0.5, y: 0.5 },
      hiddenLocation: { x: 0.5, y: 0.5 },
    });
  });

  it('continues to host SwipeImage in e2e mode so the saved-card stack renders', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();

    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    const props = mockSwipeImage.mock.calls[0][0];
    expect(props.category).toEqual({ id: 'cat-1', key: 'nature' });
    expect(props.language).toBe('fr');
    expect(typeof props.startGuessing).toBe('function');
  });

  it('opens the language filter modal when SwipeImage requests it', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();
    const renderer = await renderScreen(navigation, route);

    expect(() => renderer.root.findByProps({ testID: 'guess-feed.filter.language' })).toThrow();

    dismissSwipeInstructions(renderer);

    await act(async () => {
      mockSwipeImage.mock.calls[0][0].onOpenFilter();
      await flushEffects();
    });

    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.option.fr' })).toBeTruthy();
  });

  it('persists the selected language and rerenders SwipeImage with the updated filter', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();
    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    await act(async () => {
      mockSwipeImage.mock.calls[0][0].onOpenFilter();
      await flushEffects();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-feed.filter.language.option.de' }).props.onPress();
      await flushEffects();
    });

    expect(saveSessionLanguageFilter).toHaveBeenCalledWith('de');
    expect(mockSwipeImage.mock.calls[mockSwipeImage.mock.calls.length - 1][0].language).toBe('de');
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('de');
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
