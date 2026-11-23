import { resolveNextCard } from './nextCardResolver';
import type { ResolverCategory } from './nextCardResolver';

type GuessRouteName =
  | 'HomeScreen'
  | 'PrivateHomeScreen'
  | 'GuessPathScreen'
  | 'GuessFeedScreen'
  | 'GuessScreen';

type GuessRoute = {
  name: GuessRouteName;
  params?: Record<string, unknown>;
};

/**
 * Structural navigation contract for `navigateToNextGuess` (subset of the
 * react-navigation navigation prop: only `reset`). Mirrors the
 * `ResultNavigation` shape used by the result screens.
 */
export type GuessNavigationProp = {
  reset: (state: { index: number; routes: GuessRoute[] }) => void;
};

export interface NavigateToNextGuessArgs {
  category?: ResolverCategory | null;
  language?: string | null;
  currentListId?: number;
  isTutorial?: boolean;
  scope?: unknown;
  mode?: string | null;
}

/**
 * @deprecated As of the streak-continuity refactor (planning/features/streak-continuity-guess-path.md T1.10),
 *             this function is NOT called from the GuessScreen advance path. The advance path now uses
 *             `useReducer(advanceReducer, …)` (utils/advanceState.ts) and never bounces to the feed.
 * Retained for external callers (ShowSuccess.tsx, ShowFailure.tsx). Do NOT add new callers —
 * new advance logic should go through the state machine in GuessScreen.
 *
 *             Callers source `mode` from `useSessionModeFilter()` (session filter context) —
 *             the session mode filter must survive lose/win → next-card navigation.
 *
 *             Navigates the player to the next guess card by bouncing through GuessFeedScreen.
 *             This is a bounce — it breaks the streak. Prefer the in-screen advance path.
 *
 * Resolve the next playable card (read-only resolver: local storage
 * (`utils/localStore`, MMKV-backed) + private
 * cache only, no network) and reset to a clean navigation stack so Back from
 * GuessScreen lands on the feed (decision D3). Mirrors the GuessScreen param
 * contract of GuessFeedScreen.startGuessing (spread item, hiddenLocation alias,
 * category) so it lives in one place. Always navigates: when a next
 * card is resolved it resets to a 4-route stack ending on GuessScreen; when the
 * deck is exhausted it resets to a 3-route feed stack ending on GuessFeedScreen.
 * The resolved category is carried in BOTH GuessScreen and the back-stack
 * GuessFeedScreen so Back from an "All" card lands on an "All" feed.
 */
export async function navigateToNextGuess(navigation: GuessNavigationProp, { category, language, currentListId, isTutorial, scope, mode }: NavigateToNextGuessArgs): Promise<void> {
  const isPrivateScope = !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private';

  const result = await resolveNextCard({ category, language, currentListId, scope, mode });

  const homeRoute: GuessRoute = isPrivateScope
    ? { name: 'PrivateHomeScreen', params: { scope } }
    : { name: 'HomeScreen' };
  const guessPathRoute: GuessRoute = isPrivateScope
    ? { name: 'GuessPathScreen', params: { isTutorial, scope } }
    : { name: 'GuessPathScreen', params: { isTutorial } };
  const stackRoot: GuessRoute[] = isPrivateScope
    ? [{ name: 'HomeScreen' }, homeRoute, guessPathRoute]
    : [homeRoute, guessPathRoute];

  if (!result) {
    const feedRoute: GuessRoute = isPrivateScope
      ? { name: 'GuessFeedScreen', params: { category, scope, skipInstructions: true } }
      : { name: 'GuessFeedScreen', params: { category, skipInstructions: true } };
    const routes: GuessRoute[] = [...stackRoot, feedRoute];

    navigation.reset({
      index: routes.length - 1,
      routes,
    });
    return;
  }

  const feedCategory = result.category;
  const feedRoute: GuessRoute = isPrivateScope
    ? { name: 'GuessFeedScreen', params: { category: feedCategory, scope } }
    : { name: 'GuessFeedScreen', params: { category: feedCategory } };
  const guessParams: Record<string, unknown> = {
    ...result.card,
    hiddenLocation: result.card?.hiddenLocation ?? result.card?.touchLocation,
    category: result.category,
    isTutorial,
    skipInstructions: true,
  };

  if (isPrivateScope) {
    guessParams.scope = scope;
  }

  const routes: GuessRoute[] = [...stackRoot, feedRoute, { name: 'GuessScreen', params: guessParams }];

  navigation.reset({
    index: routes.length - 1,
    routes,
  });
}
