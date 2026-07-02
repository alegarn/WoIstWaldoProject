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
export async function navigateToNextGuess(navigation, { category, language, currentListId, isTutorial, scope }) {
  const categoryKey = category?.key || 'all';
  const isPrivateScope = scope?.kind === 'private';

  const item = await getNextImage(categoryKey, language, currentListId);

  if (!item) {
    const homeRoute = isPrivateScope
      ? { name: 'PrivateHomeScreen', params: { scope } }
      : { name: 'HomeScreen' };
    const guessPathRoute = isPrivateScope
      ? { name: 'GuessPathScreen', params: { isTutorial, scope } }
      : { name: 'GuessPathScreen', params: { isTutorial } };
    const feedRoute = isPrivateScope
      ? { name: 'GuessFeedScreen', params: { category, language, scope, skipInstructions: true } }
      : { name: 'GuessFeedScreen', params: { category, language, skipInstructions: true } };

    navigation.reset({
      index: isPrivateScope ? 3 : 2,
      routes: isPrivateScope
        ? [{ name: 'HomeScreen' }, homeRoute, guessPathRoute, feedRoute]
        : [homeRoute, guessPathRoute, feedRoute],
    });
    return;
  }

  const homeRoute = isPrivateScope
    ? { name: 'PrivateHomeScreen', params: { scope } }
    : { name: 'HomeScreen' };
  const guessPathRoute = isPrivateScope
    ? { name: 'GuessPathScreen', params: { isTutorial, scope } }
    : { name: 'GuessPathScreen', params: { isTutorial } };
  const feedRoute = isPrivateScope
    ? { name: 'GuessFeedScreen', params: { category, language, scope } }
    : { name: 'GuessFeedScreen', params: { category, language } };
  const guessParams = {
    ...item,
    hiddenLocation: item?.hiddenLocation ?? item?.touchLocation,
    category,
    language,
    isTutorial,
    skipInstructions: true,
  };

  if (isPrivateScope) {
    guessParams.scope = scope;
  }

  navigation.reset({
    index: isPrivateScope ? 4 : 3,
    routes: isPrivateScope
      ? [{ name: 'HomeScreen' }, homeRoute, guessPathRoute, feedRoute, { name: 'GuessScreen', params: guessParams }]
      : [
        homeRoute,
        guessPathRoute,
        feedRoute,
        {
          name: 'GuessScreen',
          params: guessParams,
        },
      ],
  });
}
