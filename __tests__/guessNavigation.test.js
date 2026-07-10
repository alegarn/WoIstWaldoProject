jest.mock('../utils/nextCardResolver', () => ({
  resolveNextCard: jest.fn(),
}));

import { resolveNextCard } from '../utils/nextCardResolver';
import { navigateToNextGuess } from '../utils/guessNavigation';
import { RECENT_ALL_CATEGORY } from '../constants/categories';

describe('navigateToNextGuess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets once to a clean stack with GuessScreen receiving the resolved card and original category', async () => {
    const navigation = { reset: jest.fn() };
    const category = { key: 'city' };
    const card = {
      listId: 7,
      imageFile: 'file:///cache/7.jpg',
      touchLocation: { x: 0.4, y: 0.6 },
    };
    resolveNextCard.mockResolvedValueOnce({ card, category });

    await navigateToNextGuess(navigation, {
      category,
      language: 'fr',
      currentListId: 5,
      isTutorial: true,
    });

    expect(resolveNextCard).toHaveBeenCalledWith({ category, language: 'fr', currentListId: 5, scope: undefined });
    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 3,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: true } },
        { name: 'GuessFeedScreen', params: { category, language: 'fr' } },
        {
          name: 'GuessScreen',
          params: {
            listId: 7,
            imageFile: 'file:///cache/7.jpg',
            touchLocation: { x: 0.4, y: 0.6 },
            hiddenLocation: { x: 0.4, y: 0.6 },
            category,
            language: 'fr',
            isTutorial: true,
            skipInstructions: true,
          },
        },
      ],
    });
  });

  it('carries the resolved All category into both GuessScreen and the back-stack GuessFeedScreen on category exhaustion', async () => {
    const navigation = { reset: jest.fn() };
    const originalCategory = { key: 'city', id: 7 };
    const allCard = {
      listId: 1,
      imageFile: 'file:///cache/all1.jpg',
      hiddenLocation: { x: 0.2, y: 0.8 },
    };
    resolveNextCard.mockResolvedValueOnce({ card: allCard, category: RECENT_ALL_CATEGORY });

    await navigateToNextGuess(navigation, {
      category: originalCategory,
      language: 'en',
      currentListId: 9,
      isTutorial: false,
    });

    expect(resolveNextCard).toHaveBeenCalledWith({
      category: originalCategory,
      language: 'en',
      currentListId: 9,
      scope: undefined,
    });
    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 3,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: false } },
        { name: 'GuessFeedScreen', params: { category: RECENT_ALL_CATEGORY, language: 'en' } },
        {
          name: 'GuessScreen',
          params: {
            listId: 1,
            imageFile: 'file:///cache/all1.jpg',
            hiddenLocation: { x: 0.2, y: 0.8 },
            category: RECENT_ALL_CATEGORY,
            language: 'en',
            isTutorial: false,
            skipInstructions: true,
          },
        },
      ],
    });
  });

  it('resets once to the 3-route feed stack rooted at the original category when both decks are exhausted', async () => {
    const navigation = { reset: jest.fn() };
    const category = { key: 'nature' };
    resolveNextCard.mockResolvedValueOnce(null);

    await navigateToNextGuess(navigation, {
      category,
      language: 'de',
      currentListId: 9,
      isTutorial: false,
    });

    expect(resolveNextCard).toHaveBeenCalledWith({ category, language: 'de', currentListId: 9, scope: undefined });
    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: false } },
        { name: 'GuessFeedScreen', params: { category, language: 'de', skipInstructions: true } },
      ],
    });
  });

  it('resets to a 5-route stack rooted at HomeScreen when private scope has a next card', async () => {
    const navigation = { reset: jest.fn() };
    const scope = { kind: 'private', groupId: 'g-1' };
    const category = { key: 'city' };
    const card = {
      listId: 7,
      imageFile: 'file:///cache/7.jpg',
      touchLocation: { x: 0.4, y: 0.6 },
    };
    resolveNextCard.mockResolvedValueOnce({ card, category });

    await navigateToNextGuess(navigation, {
      category,
      language: 'fr',
      currentListId: 5,
      isTutorial: true,
      scope,
    });

    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 4,
      routes: [
        { name: 'HomeScreen' },
        { name: 'PrivateHomeScreen', params: { scope } },
        { name: 'GuessPathScreen', params: { isTutorial: true, scope } },
        { name: 'GuessFeedScreen', params: { category, language: 'fr', scope } },
        {
          name: 'GuessScreen',
          params: expect.objectContaining({
            listId: 7,
            imageFile: 'file:///cache/7.jpg',
            hiddenLocation: { x: 0.4, y: 0.6 },
            category,
            language: 'fr',
            isTutorial: true,
            scope,
          }),
        },
      ],
    });
  });

  it('resets to a 4-route feed stack rooted at HomeScreen when private scope decks are exhausted', async () => {
    const navigation = { reset: jest.fn() };
    const scope = { kind: 'private', groupId: 'g-1' };
    const category = { key: 'nature' };
    resolveNextCard.mockResolvedValueOnce(null);

    await navigateToNextGuess(navigation, {
      category,
      language: 'de',
      currentListId: 9,
      isTutorial: false,
      scope,
    });

    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 3,
      routes: [
        { name: 'HomeScreen' },
        { name: 'PrivateHomeScreen', params: { scope } },
        { name: 'GuessPathScreen', params: { isTutorial: false, scope } },
        { name: 'GuessFeedScreen', params: { category, language: 'de', scope, skipInstructions: true } },
      ],
    });
  });
});
