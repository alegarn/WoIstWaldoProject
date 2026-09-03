/**
 * Type declarations for `utils/nextCardResolver.js`. The runtime module is
 * plain JavaScript; these declarations pin the resolver contract used by
 * `utils/handleGuessOutcome.ts`. `card` mirrors `getNextImageForScope`'s
 * `CardImage` return (utils/storageDatum.ts).
 */

import type { CardImage } from '../services/cardDeck';

export interface ResolverCategory {
  id?: string | number | null;
  key?: string;
}

export interface ResolveNextCardArgs {
  category?: ResolverCategory | null;
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
  currentPictureId?: string;
}

export interface ResolvedNextCard {
  card: CardImage;
  category: ResolverCategory | null;
}

export function resolveNextCard(args: ResolveNextCardArgs): Promise<ResolvedNextCard | null>;
