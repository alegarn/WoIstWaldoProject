jest.mock('../utils/storageDatum', () => ({
  getNextImage: jest.fn(),
}));

import { getNextImage } from '../utils/storageDatum';
import { navigateToNextGuess } from '../utils/guessNavigation';

describe('navigateToNextGuess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets once to a clean stack with GuessScreen receiving the next item', async () => {
    const navigation = { reset: jest.fn() };
    const category = { key: 'city' };
    const item = {
      listId: 7,
      imageFile: 'file:///cache/7.jpg',
      touchLocation: { x: 0.4, y: 0.6 },
    };
    getNextImage.mockResolvedValueOnce(item);

    await navigateToNextGuess(navigation, {
      category,
      language: 'fr',
      currentListId: 5,
      isTutorial: true,
    });

    expect(getNextImage).toHaveBeenCalledWith('city', 'fr', 5);
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
          },
        },
      ],
    });
  });

  it('falls back to the "all" category key when category is missing', async () => {
    const navigation = { reset: jest.fn() };
    getNextImage.mockResolvedValueOnce({ listId: 1, hiddenLocation: { x: 0.1, y: 0.2 } });

    await navigateToNextGuess(navigation, { category: null, language: 'en' });

    expect(getNextImage).toHaveBeenCalledWith('all', 'en', undefined);
  });

  it('resets once to the 3-route feed stack when the deck is exhausted', async () => {
    const navigation = { reset: jest.fn() };
    const category = { key: 'nature' };
    getNextImage.mockResolvedValueOnce(null);

    await navigateToNextGuess(navigation, {
      category,
      language: 'de',
      currentListId: 9,
      isTutorial: false,
    });

    expect(getNextImage).toHaveBeenCalledWith('nature', 'de', 9);
    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: false } },
        { name: 'GuessFeedScreen', params: { category, language: 'de' } },
      ],
    });
  });
});
