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
export function normalizeListIds(cards: CardImage[]): CardImage[];

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
