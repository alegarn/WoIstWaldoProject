import { getNextImage } from './storageDatum';

/**
 * Resolve the next playable card from the persisted deck and reset to a clean
 * navigation stack so Back from GuessScreen lands on the feed (decision D3).
 * Mirrors the GuessScreen param contract of GuessFeedScreen.startGuessing
 * (spread item, hiddenLocation alias, category, language) so it lives in one place.
 * Always navigates: when a next card is resolved it resets to a 4-route stack
 * ending on GuessScreen; when the deck is exhausted it resets to a 3-route
 * feed stack ending on GuessFeedScreen. Both stacks end on a Back-to-feed target.
 */
export async function navigateToNextGuess(navigation, { category, language, currentListId, isTutorial }) {
  const categoryKey = category?.key || 'all';

  const item = await getNextImage(categoryKey, language, currentListId);

  if (!item) {
    navigation.reset({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial } },
        { name: 'GuessFeedScreen', params: { category, language } },
      ],
    });
    return;
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
}
