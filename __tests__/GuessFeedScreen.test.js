const mockSwipeImage = jest.fn(() => null);
const mockSwipeImageMounts = [];
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
  const React = require('react');

  return function MockSwipeImage(props) {
    React.useEffect(() => {
      mockSwipeImageMounts.push(
        `${props.category?.key || 'all'}:${props.language || 'any'}:${props.mode || 'any'}`
      );
    }, []);
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
  getSessionModeFilter: jest.fn(),
  saveSessionModeFilter: jest.fn(),
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
  getSessionModeFilter,
  saveSessionModeFilter,
} from '../utils/storageDatum';

describe('GuessFeedScreen', () => {
  const mountedRenderers = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSwipeImageMounts.length = 0;
    getOnboardingCompleted.mockResolvedValue(true);
    getSessionLanguageFilter.mockResolvedValue('fr');
    saveSessionLanguageFilter.mockResolvedValue(undefined);
    getSessionModeFilter.mockResolvedValue(null);
    saveSessionModeFilter.mockResolvedValue(undefined);
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

    expect(mockSwipeInstructions).toHaveBeenCalled();
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
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('any');

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

  it("no route language and no stored filter → SwipeImage receives language 'any' (matches GuessPathScreen navigation fallback, I6)", async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: undefined });

    getSessionLanguageFilter.mockResolvedValue(null);

    const renderer = await renderScreen(navigation, route);

    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.language.current' }).props.children).toBe('any');

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    expect(mockSwipeImage.mock.calls[0][0].language).toBe('any');
  });

  it("startGuessing forwards 'any' — never 'en' — when unset", async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: undefined });

    getSessionLanguageFilter.mockResolvedValue(null);

    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    const { startGuessing } = mockSwipeImage.mock.calls[0][0];

    await act(async () => {
      startGuessing({
        item: {
          pictureId: 'img-1',
          touchLocation: { x: 0.5, y: 0.5 },
        },
      });
    });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith(
      'GuessScreen',
      expect.objectContaining({ language: 'any' })
    );
    expect(navigation.navigate.mock.calls[0][1].language).not.toBe('en');
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
      filterMode: 'any',
    });
  });

  it('routes a shape card to GuessScreen carrying mode and shape', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();
    const shape = [
      { x: 0.5, y: 0.3 },
      { x: 0.7, y: 0.5 },
      { x: 0.5, y: 0.7 },
      { x: 0.3, y: 0.5 },
      { x: 0.5, y: 0.3 },
    ];

    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    const { startGuessing } = mockSwipeImage.mock.calls[0][0];

    await act(async () => {
      startGuessing({
        item: {
          pictureId: 'img-shape-1',
          imageFile: 'file:///shape.jpg',
          listId: 8,
          description: 'Find the shape',
          touchLocation: { x: null, y: null },
          mode: 'shape',
          shape,
        },
      });
    });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('GuessScreen', expect.objectContaining({
      pictureId: 'img-shape-1',
      hiddenLocation: { x: null, y: null },
      mode: 'shape',
      shape,
    }));
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

  it('seeds the mode filter from the route mode param without reading storage', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ mode: 'point' });
    const renderer = await renderScreen(navigation, route);

    expect(getSessionModeFilter).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode.current' }).props.children).toBe('point');

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage).toHaveBeenCalledTimes(1);
    expect(mockSwipeImage.mock.calls[0][0].mode).toBe('point');
  });

  it('falls back to the stored session mode filter, then to the any sentinel', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: undefined });
    const deferredMode = createDeferred();

    getSessionModeFilter.mockReturnValue(deferredMode.promise);

    const renderer = await renderScreen(navigation, route);

    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode.current' }).props.children).toBe('any');

    await act(async () => {
      deferredMode.resolve('shape');
      await flushEffects();
    });

    expect(getSessionModeFilter).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode.current' }).props.children).toBe('shape');

    dismissSwipeInstructions(renderer);

    expect(mockSwipeImage.mock.calls[mockSwipeImage.mock.calls.length - 1][0].mode).toBe('shape');
  });

  it('opens the mode filter modal when the badge detail mode button requests it', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();
    const renderer = await renderScreen(navigation, route);

    expect(() => renderer.root.findByProps({ testID: 'guess-feed.filter.mode' })).toThrow();

    dismissSwipeInstructions(renderer);

    await act(async () => {
      mockSwipeImage.mock.calls[0][0].onOpenModeFilter();
      await flushEffects();
    });

    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode.option.shape' })).toBeTruthy();
  });

  it('persists the selected mode and remounts the deck with the new mode key segment', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute();
    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    await act(async () => {
      mockSwipeImage.mock.calls[0][0].onOpenModeFilter();
      await flushEffects();
    });

    expect(mockSwipeImageMounts).toEqual(['nature:fr:any']);

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-feed.filter.mode.option.shape' }).props.onPress();
      await flushEffects();
    });

    expect(saveSessionModeFilter).toHaveBeenCalledWith('shape');
    expect(mockSwipeImage.mock.calls[mockSwipeImage.mock.calls.length - 1][0].mode).toBe('shape');
    expect(renderer.root.findByProps({ testID: 'guess-feed.filter.mode.current' }).props.children).toBe('shape');
    expect(mockSwipeImageMounts).toEqual(['nature:fr:any', 'nature:fr:shape']);
  });

  it('startGuessing threads filterMode beside the card mode without shadowing it (D8)', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = makeRoute({ language: undefined });

    getSessionLanguageFilter.mockResolvedValue('fr');
    getSessionModeFilter.mockResolvedValue('point');

    const renderer = await renderScreen(navigation, route);

    dismissSwipeInstructions(renderer);

    const { startGuessing } = mockSwipeImage.mock.calls[0][0];

    await act(async () => {
      startGuessing({
        item: {
          pictureId: 'img-card-1',
          touchLocation: { x: 0.5, y: 0.5 },
          mode: 'shape',
          shape: [{ x: 0.5, y: 0.5 }],
        },
      });
    });

    const params = navigation.navigate.mock.calls[0][1];
    expect(params.mode).toBe('shape');
    expect(params.filterMode).toBe('point');
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
