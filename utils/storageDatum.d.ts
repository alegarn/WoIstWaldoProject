/**
 * Type declarations for `utils/storageDatum.js`. The runtime module is plain
 * JavaScript with destructured `{ ... } = {}` parameter defaults, which TS
 * infers as `{}` — too loose for typed callers. These declarations pin the
 * structured-args contract actually used at runtime.
 *
 * Note: the JSDoc on `getRemainingDeckCount` in the .js source says
 * `category?: string|null`, but the function body reads `category?.key` /
 * `category?.id`, so the real contract is `category: { key, id? }`. This
 * declaration reflects the runtime contract, not the stale JSDoc.
 */

import type { CardImage } from '../services/cardDeck';

export interface DeckWriteLockScope {
  kind?: string;
  groupId?: string;
}

export interface DeckWriteLockKeyArgs {
  categoryKey?: string | null;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: DeckWriteLockScope | null;
}

export interface RemainingDeckCategory {
  key: string;
  id?: string | number;
}

export interface RemainingDeckCountArgs {
  category?: RemainingDeckCategory;
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
}

export interface ScopeDeckCountArgs {
  category?: RemainingDeckCategory;
  language?: string | null;
  scope?: unknown;
}

export function getRemainingDeckCount(args?: RemainingDeckCountArgs): Promise<number>;
export function getDeckCountForScope(args?: ScopeDeckCountArgs): Promise<number>;
export function deckWriteLockKey(args?: DeckWriteLockKeyArgs): string;
// Guarantee every card has a finite, UNIQUE listId: assigns ids for
// missing/non-finite listIds AND reassigns later duplicates past the deck's
// pre-pass max. Healthy decks (no missing, no duplicate finite ids) return
// the input array by identity.
export function normalizeListIds(cards: CardImage[]): CardImage[];
export function removeImageFromList(listId: number, categoryKey?: string | null, language?: string | null): Promise<null>;
export function wipePublicGuessStorage(): Promise<void>;

export interface NextImagesForScopeArgs {
  category?: { key?: string; id?: string | number };
  language?: string | null;
  currentListId?: number;
  scope?: unknown;
  limit?: number;
}

export function getNextImagesForScope(args?: NextImagesForScopeArgs): Promise<CardImage[]>;

export function getOnboardingCompleted(): Promise<boolean>;
export function getSessionLanguageFilter(): Promise<string | null>;
export function saveSessionLanguageFilter(code: string | null): Promise<null>;
export function getPreferredLanguage(): Promise<string | null>;

// F3a exhausted-category cache (scope-aware: PUBLIC → AsyncStorage, PRIVATE →
// group feed cache namespace via services/groups/groupFeedCache).
export function exhaustedCategoryKey(categoryKey: string | null | undefined, language?: string | null): string;
export function markCategoryExhausted(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void>;
export function isCategoryExhausted(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<boolean>;
export function clearExhaustedCategory(categoryKey: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void>;

// Persist the feed cursor (last-served image uuid) for (categoryKey, language,
// scope). PUBLIC scope stores at `lastImageUuid:<cat|'all'>:<lang|'any'>`;
// PRIVATE scope stores at the group-scoped
// `groupFeed:<groupId>:game:<cat|'all'>:<lang|'any'>:cursor` key.
export function saveLastImageUuid(
  imageUuid: string,
  categoryKey?: string | null,
  language?: string | null,
  scope?: unknown
): Promise<null>;

