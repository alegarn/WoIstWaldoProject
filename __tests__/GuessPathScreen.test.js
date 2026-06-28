const mockGuessCategoryCard = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);

jest.mock('../components/UI/GuessCategoryCard', () => {
  return function MockGuessCategoryCard(props) {
    mockGuessCategoryCard(props);
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
import { act, create } from 'react-test-renderer';

import GuessPathScreen from '../screens/GuessScreens/GuessPathScreen';
import { AuthContext } from '../store/auth-context';
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
  const mountedRenderers = [];
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

  afterEach(async () => {
    await act(async () => {
      mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
    });

    Dimensions.get.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen(route = { params: {} }) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <GuessPathScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    mountedRenderers.push(renderer);

    return renderer;
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
    await renderScreen();

    const renderedKeys = mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    );

    expect(renderedKeys[0]).toBe('all');
    expect(mockGuessCategoryCard.mock.calls[0][0].category).toEqual(
      expect.objectContaining({ id: 'all', key: 'all', name: 'Recent/All' })
    );
  });

  it('renders one GuessCategoryCard per category returned by the api', async () => {
    await renderScreen();

    const renderedKeys = [...new Set(mockGuessCategoryCard.mock.calls.map(
      ([props]) => props.category.id
    ))];

    expect(renderedKeys).toEqual(['all', 'nature', 'city']);
  });

  it('passes the grid testID and slug-based card testIDs to the flat list', async () => {
    const renderer = await renderScreen();

    expect(renderer.root.findByProps({ testID: 'guess-path.category.grid' })).toBeTruthy();
    expect(getCardPropsByKey('nature')).toEqual(
      expect.objectContaining({
        testIDPrefix: 'guess-path.category',
        category: expect.objectContaining({ id: 'nature', name: 'Nature' }),
      })
    );
  });

  it('navigates to GuessFeedScreen with the selected category and resolved language', async () => {
    await renderScreen();

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

    expect(() =>
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toThrow();

    await act(async () => {
      getDetailsButtonProps().onPress();
    });

    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'guess-path.filter.language.option.fr' })
    ).toBeTruthy();
  });

  it('persists the selected language and updates the resolved language label', async () => {
    const renderer = await renderScreen();

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

  it('keeps the e2e home button available on the category screen', async () => {
    isE2EMode.mockReturnValue(true);

    const renderer = await renderScreen();

    expect(renderer.root.findByProps({ testID: 'guess-path.button.home' })).toBeTruthy();
  });

  it('renders the TutorialOverlay only when the isTutorial route param is set', async () => {
    await renderScreen({ params: { isTutorial: true } });

    expect(mockTutorialOverlay).toHaveBeenCalled();
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'GuessPathScreen' })
    );
  });

  it('does not render the TutorialOverlay when isTutorial is absent', async () => {
    await renderScreen();

    expect(mockTutorialOverlay).not.toHaveBeenCalled();
  });
});
