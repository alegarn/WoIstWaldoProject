import { getNextImage } from './storageDatum';

/**
 * Resolve the next playable card from the persisted deck and reset to a clean
 * navigation stack so Back from GuessScreen lands on the feed (decision D3).
 * Mirrors the GuessScreen param contract of GuessFeedScreen.startGuessing
 * (spread item, hiddenLocation alias, category, language) so it lives in one place.
 * Returns true when a card was resolved and the stack was reset, false when the
 * deck is exhausted so the caller can fall back to the feed.
 */
export async function navigateToNextGuess(navigation, { category, language, currentListId, isTutorial }) {
  const categoryKey = category?.key || 'all';

  const item = await getNextImage(categoryKey, language, currentListId);

  if (!item) {
    return false;
  }

  navigation.reset({
    index: 3,
    routes: [
      { name: 'HomeScreen' },
      { name: 'GuessPathScreen', params: { isTutorial } },
      { name: 'GuessFeedScreen', params: { category, language } },
      {
        name: 'GuessScreen',
        params: {
          ...item,
          hiddenLocation: item?.hiddenLocation ?? item?.touchLocation,
          category,
          language,
          isTutorial,
        },
      },
    ],
  });

  return true;
}
