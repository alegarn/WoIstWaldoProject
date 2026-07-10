import { resolveNextCard } from './nextCardResolver';

/**
 * Resolve the next playable card (read-only resolver: AsyncStorage + private
 * cache only, no network) and reset to a clean navigation stack so Back from
 * GuessScreen lands on the feed (decision D3). Mirrors the GuessScreen param
 * contract of GuessFeedScreen.startGuessing (spread item, hiddenLocation alias,
 * category, language) so it lives in one place. Always navigates: when a next
 * card is resolved it resets to a 4-route stack ending on GuessScreen; when the
 * deck is exhausted it resets to a 3-route feed stack ending on GuessFeedScreen.
 * The resolved category is carried in BOTH GuessScreen and the back-stack
 * GuessFeedScreen so Back from an "All" card lands on an "All" feed.
 */
export async function navigateToNextGuess(navigation, { category, language, currentListId, isTutorial, scope }) {
  const isPrivateScope = scope?.kind === 'private';

  const result = await resolveNextCard({ category, language, currentListId, scope });

  if (!result) {
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

  const feedCategory = result.category;
  const homeRoute = isPrivateScope
    ? { name: 'PrivateHomeScreen', params: { scope } }
    : { name: 'HomeScreen' };
  const guessPathRoute = isPrivateScope
    ? { name: 'GuessPathScreen', params: { isTutorial, scope } }
    : { name: 'GuessPathScreen', params: { isTutorial } };
  const feedRoute = isPrivateScope
    ? { name: 'GuessFeedScreen', params: { category: feedCategory, language, scope } }
    : { name: 'GuessFeedScreen', params: { category: feedCategory, language } };
  const guessParams = {
    ...result.card,
    hiddenLocation: result.card?.hiddenLocation ?? result.card?.touchLocation,
    category: result.category,
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
