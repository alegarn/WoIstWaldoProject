jest.mock('../utils/storageDatum', () => ({
  getNextImage: jest.fn(),
}));

import { getNextImage } from '../utils/storageDatum';
import { navigateToNextGuess } from '../utils/guessNavigation';

describe('navigateToNextGuess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets to a clean stack with GuessScreen receiving the next item and returns true', async () => {
    const navigation = { reset: jest.fn() };
    const category = { key: 'city' };
    const item = {
      listId: 7,
      imageFile: 'file:///cache/7.jpg',
      touchLocation: { x: 0.4, y: 0.6 },
    };
    getNextImage.mockResolvedValueOnce(item);

    const result = await navigateToNextGuess(navigation, {
      category,
      language: 'fr',
      currentListId: 5,
      isTutorial: true,
    });

    expect(result).toBe(true);
    expect(getNextImage).toHaveBeenCalledWith('city', 'fr', 5);
    expect(navigation.reset).toHaveBeenCalledTimes(1);

    const resetArg = navigation.reset.mock.calls[0][0];
    expect(resetArg.index).toBe(3);
    expect(resetArg.routes).toHaveLength(4);
    expect(resetArg.routes[0]).toEqual({ name: 'HomeScreen' });
    expect(resetArg.routes[1]).toEqual({ name: 'GuessPathScreen', params: { isTutorial: true } });
    expect(resetArg.routes[2]).toEqual({ name: 'GuessFeedScreen', params: { category, language: 'fr' } });
    expect(resetArg.routes[3].name).toBe('GuessScreen');
    expect(resetArg.routes[3].params).toEqual({
      listId: 7,
      imageFile: 'file:///cache/7.jpg',
      touchLocation: { x: 0.4, y: 0.6 },
      hiddenLocation: { x: 0.4, y: 0.6 },
      category,
      language: 'fr',
      isTutorial: true,
    });
  });

  it('falls back to the "all" category key when category is missing', async () => {
    const navigation = { reset: jest.fn() };
    getNextImage.mockResolvedValueOnce({ listId: 1, hiddenLocation: { x: 0.1, y: 0.2 } });

    await navigateToNextGuess(navigation, { category: null, language: 'en' });

    expect(getNextImage).toHaveBeenCalledWith('all', 'en', undefined);
  });

  it('does not reset navigation and returns false when the deck is exhausted', async () => {
    const navigation = { reset: jest.fn() };
    getNextImage.mockResolvedValueOnce(null);

    const result = await navigateToNextGuess(navigation, {
      category: { key: 'nature' },
      language: 'de',
      currentListId: 9,
    });

    expect(result).toBe(false);
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});
