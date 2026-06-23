const mockGuessCategoryCard = jest.fn(() => null);
const mockSwipeInstructions = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);

<<<<<<< Updated upstream
=======
const mockGetCategories = jest.fn();
const mockGetSessionLanguageFilter = jest.fn();
const mockSaveSessionLanguageFilter = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');

  function MockModal({ children, visible }) {
    if (!visible) {
      return null;
    }
    return React.createElement(React.Fragment, null, children);
  }

  function MockFlatList({ data, renderItem, testID }) {
    return React.createElement(
      'FlatList',
      { testID },
      (data || []).map((item, index) => renderItem({ item, index }))
    );
  }

  return {
    Modal: MockModal,
    FlatList: MockFlatList,
    View: 'View',
    Text: 'Text',
    ScrollView: 'ScrollView',
    Pressable: 'Pressable',
    Dimensions: {
      get: jest.fn(() => ({ width: 320, height: 640, scale: 1, fontScale: 1 })),
    },
    StyleSheet: {
      hairlineWidth: 1,
      create: (styles) => styles,
    },
  };
});

jest.mock('../utils/categoryRequests', () => ({
  getCategories: (...args) => mockGetCategories(...args),
}));

jest.mock('../utils/storageDatum', () => ({
  getSessionLanguageFilter: (...args) => mockGetSessionLanguageFilter(...args),
  saveSessionLanguageFilter: (...args) => mockSaveSessionLanguageFilter(...args),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({}),
  };
});

>>>>>>> Stashed changes
jest.mock('../components/UI/GuessCategoryCard', () => {
  return function MockGuessCategoryCard(props) {
    mockGuessCategoryCard(props);
    return null;
  };
});

jest.mock('../components/Instructions/SwipeInstructions', () => {
<<<<<<< Updated upstream
  const React = require('react');
  const { Pressable } = require('react-native');

  return function MockSwipeInstructions({ handleFilterClick }) {
    mockSwipeInstructions({ handleFilterClick });
    return (
      <Pressable testID="guess-path.stub.show-grid" onPress={handleFilterClick} />
    );
=======
  return function MockSwipeInstructions(props) {
    mockSwipeInstructions(props);
    return null;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
jest.mock('../utils/categoryRequests', () => ({
  getCategories: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getSessionLanguageFilter: jest.fn(),
  saveSessionLanguageFilter: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Dimensions } from 'react-native';
=======
import React from 'react';
>>>>>>> Stashed changes
import { act, create } from 'react-test-renderer';

import GuessPathScreen from '../screens/GuessScreens/GuessPathScreen';
import { AuthContext } from '../store/auth-context';
<<<<<<< Updated upstream
import { getCategories } from '../utils/categoryRequests';
import {
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';

const CATEGORIES = [
  { id: '1', key: 'nature', name: 'Nature', thumbnailUrl: 'x', count: 5 },
  { id: '2', key: 'city', name: 'City', thumbnailUrl: 'y', count: 3 },
];

describe('GuessPathScreen', () => {
  const contextValue = { token: 'Bearer token' };
  let navigation;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
    isE2EMode.mockReturnValue(false);
    getCategories.mockResolvedValue({ data: CATEGORIES });
    getSessionLanguageFilter.mockResolvedValue(null);
    saveSessionLanguageFilter.mockResolvedValue(undefined);
    navigation = { navigate: jest.fn(), popToTop: jest.fn(), goBack: jest.fn() };
  });

  afterEach(() => {
    Dimensions.get.mockRestore();
=======

const CATEGORIES_PAYLOAD = [
  {
    id: 'uuid-1',
    key: 'nature',
    name: 'Nature',
    thumbnailUrl: { uri: 'https://example.com/nature.jpg' },
    sortOrder: 1,
  },
  {
    id: 'uuid-2',
    key: 'city',
    name: 'City',
    thumbnailUrl: { uri: 'https://example.com/city.jpg' },
    sortOrder: 2,
  },
];

describe('GuessPathScreen', () => {
  const contextValue = { token: 'token', userId: '42' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategories.mockResolvedValue({ data: CATEGORIES_PAYLOAD });
    mockGetSessionLanguageFilter.mockResolvedValue('en');
    mockSaveSessionLanguageFilter.mockResolvedValue(undefined);
>>>>>>> Stashed changes
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
<<<<<<< Updated upstream
    await Promise.resolve();
  }

  async function renderScreen(route = { params: {} }) {
=======
  }

  async function renderScreen(route = { params: {} }) {
    const navigation = { navigate: jest.fn(), popToTop: jest.fn() };
>>>>>>> Stashed changes
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <GuessPathScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
<<<<<<< Updated upstream

      await flushEffects();
    });

    return renderer;
  }

  function dismissOverlay(renderer) {
    act(() => {
      renderer.root.findByProps({ testID: 'guess-path.stub.show-grid' }).props.onPress();
    });
  }

  function getCardPropsByKey(key) {
    const call = mockGuessCategoryCard.mock.calls.find(
      ([props]) => props.category.id === key
    );
    return call?.[0];
  }

  function getDetailsButtonProps() {
    const call = mockIconButton.mock.calls.find(
      ([props]) => props.testID === 'guess-path.button.details'
    );
    return call?.[0];
  }

  it('fetches categories on mount with the auth context', async () => {
    await renderScreen();

    expect(getCategories).toHaveBeenCalledWith({ context: contextValue });
    expect(getCategories).toHaveBeenCalledTimes(1);
  });

  it('reads the persisted session language filter on mount', async () => {
    await renderScreen();

    expect(getSessionLanguageFilter).toHaveBeenCalledTimes(1);
  });

  it('renders the synthetic Recent/All card as the first grid item', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );

    expect(renderedKeys[0]).toBe('all');
    expect(mockGuessCategoryCard.mock.calls[0][0].category).toEqual(
      expect.objectContaining({ id: 'all', key: 'all', name: 'Recent/All' })
    );
  });

  it('renders one GuessCategoryCard per category returned by the api', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );

    expect(renderedKeys).toEqual(['all', 'nature', 'city']);
  });

  it('passes the grid testID and slug-based card testIDs to the flat list', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    expect(renderer.root.findByProps({ testID: 'guess-path.category.grid' })).toBeTruthy();
    expect(mockGuessCategoryCard.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        testIDPrefix: 'guess-path.category',
        category: expect.objectContaining({ id: 'nature', name: 'Nature' }),
      })
    );
  });

  it('navigates to GuessFeedScreen with the selected category and resolved language', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    const natureCard = getCardPropsByKey('nature');

    await act(async () => {
      natureCard.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ key: 'nature', name: 'Nature' }),
      language: 'any',
    });
  });

  it('shows the resolved language sentinel (en) while AsyncStorage has not resolved', async () => {
    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('en');
  });

  it('opens the language filter modal when the details button is tapped', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toThrow();

    await act(async () => {
      getDetailsButtonProps().onPress();
=======
      await flushEffects();
    });

    return { renderer, navigation };
  }

  async function dismissOverlay() {
    await act(async () => {
      const props =
        mockSwipeInstructions.mock.calls[mockSwipeInstructions.mock.calls.length - 1][0];
      props.handleFilterClick();
      await Promise.resolve();
    });
  }

  function getCardCalls() {
    return mockGuessCategoryCard.mock.calls.map(([props]) => props);
  }

  function getDetailsButton() {
    return mockIconButton.mock.calls
      .map(([props]) => props)
      .find((props) => props.testID === 'guess-path.button.details');
  }

  it('calls getCategories with the auth context on mount', async () => {
    await renderScreen();

    expect(mockGetCategories).toHaveBeenCalledWith({ context: contextValue });
    expect(mockGetCategories).toHaveBeenCalledTimes(1);
  });

  it('renders the synthetic Recent/All card first without a count badge', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    const calls = getCardCalls();
    expect(calls.length).toBeGreaterThan(0);

    const firstCall = calls[0];
    expect(firstCall.category).toEqual(
      expect.objectContaining({ id: 'all', key: 'all', name: 'Recent/All' })
    );
    expect(firstCall.count).toBeUndefined();
  });

  it('renders one GuessCategoryCard per category after the synthetic card', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    const calls = getCardCalls();
    expect(calls.length).toBe(1 + CATEGORIES_PAYLOAD.length);
    expect(calls[1].category).toEqual(expect.objectContaining({ key: 'nature' }));
    expect(calls[2].category).toEqual(expect.objectContaining({ key: 'city' }));
  });

  it('exposes the FlatList grid testID', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    expect(
      renderer.root.findByProps({ testID: 'guess-path.category.grid' })
    ).toBeTruthy();
  });

  it('uses the category.key slug (never the uuid) for the card testID surface', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    const calls = getCardCalls();
    calls.forEach((props) => {
      expect(props.testIDPrefix).toBe('guess-path.category');
      expect(props.category.id).toBe(props.category.key);
    });

    const natureCall = calls.find((props) => props.category.key === 'nature');
    expect(natureCall.category.id).not.toBe('uuid-1');
    expect(natureCall.category.id).toBe('nature');
  });

  it('navigates to GuessFeedScreen carrying the category and language when a card is tapped', async () => {
    const { renderer, navigation } = await renderScreen();
    await dismissOverlay(renderer);

    const natureCardProps = getCardCalls().find((props) => props.category.key === 'nature');

    await act(async () => {
      natureCardProps.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GuessFeedScreen', {
      category: expect.objectContaining({ id: 'uuid-1', key: 'nature' }),
      language: 'en',
    });
  });

  it('always renders the hidden current-language testID as a string defaulting to en while the AsyncStorage read is in flight', async () => {
    let resolveSession;
    mockGetSessionLanguageFilter.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );

    const { renderer } = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props.children
    ).toBe('en');

    await act(async () => {
      resolveSession('fr');
      await flushEffects();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props.children
    ).toBe('fr');
  });

  it('opens the language filter modal when the details button is pressed', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    expect(() => {
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' });
    }).toThrow();

    const detailsButton = getDetailsButton();
    expect(detailsButton).toBeDefined();

    await act(async () => {
      detailsButton.onPress();
>>>>>>> Stashed changes
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' })
    ).toBeTruthy();
  });

<<<<<<< Updated upstream
  it('persists the selected language and updates the resolved language label', async () => {
    const renderer = await renderScreen();
    dismissOverlay(renderer);

    await act(async () => {
      getDetailsButtonProps().onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('en');

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' }).props.onPress();
      await flushEffects();
    });

    expect(saveSessionLanguageFilter).toHaveBeenCalledWith('fr');
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props
        .children
    ).toBe('fr');
  });

  it('renders the TutorialOverlay only when the isTutorial route param is set', async () => {
    await renderScreen({ params: { isTutorial: true } });

    expect(mockTutorialOverlay).toHaveBeenCalled();
=======
  it('persists the selected language via saveSessionLanguageFilter and updates local state', async () => {
    const { renderer } = await renderScreen();
    await dismissOverlay(renderer);

    const detailsButton = getDetailsButton();

    await act(async () => {
      detailsButton.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.de' }).props.onPress();
    });

    expect(mockSaveSessionLanguageFilter).toHaveBeenCalledWith('de');
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.current' }).props.children
    ).toBe('de');
  });

  it('preserves the SwipeInstructions overlay (first-visit tutorial) wiring', async () => {
    await renderScreen();

    expect(mockSwipeInstructions).toHaveBeenCalled();
    const props = mockSwipeInstructions.mock.calls[0][0];
    expect(typeof props.handleFilterClick).toBe('function');
  });

  it('preserves the TutorialOverlay wiring when the isTutorial route param is set', async () => {
    await renderScreen({ params: { isTutorial: true } });

>>>>>>> Stashed changes
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'GuessPathScreen' })
    );
  });
<<<<<<< Updated upstream

  it('does not render the TutorialOverlay when isTutorial is absent', async () => {
    await renderScreen();

    expect(mockTutorialOverlay).not.toHaveBeenCalled();
  });
=======
>>>>>>> Stashed changes
});
