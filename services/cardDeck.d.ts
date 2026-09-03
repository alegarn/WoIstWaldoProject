/**
 * Type declarations for `services/cardDeck.js`. The runtime module is plain
 * JavaScript; these types document the structured-args contract that callers
 * (notably `services/cardPrefetcher.ts`, `utils/nextCardAdvancer.ts`, and the
 * jest mocks in `__tests__/cardPrefetcher.test.ts`) rely on.
 */

export interface CardImage {
  listId?: number;
  pictureId?: string;
  imageFile?: string;
  [key: string]: unknown;
}

export interface FetchCardBatchArgs {
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
  authContext?: unknown;
  pictureIdOverride?: string | null;
}

export type FetchCardBatchResult =
  | { isError: true; title?: string; message?: string; reason?: unknown }
  | { isError: false; reason?: 'empty' | 'played-out'; images: CardImage[] };

export interface AppendCardBatchArgs {
  cards: CardImage[];
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
}

export interface PersistCardBatchArgs {
  cards: CardImage[];
  categoryKey?: string;
  categoryId?: string | number | null;
  language?: string | null;
  scope?: unknown;
}

export interface RemoveCardFromGroupDeckArgs {
  groupId: string;
  categoryId?: string | number | null;
  language?: string | null;
  listId: number;
}

export interface ProbeAllPoolForUnplayedArgs {
  language?: string | null;
  scope?: unknown;
  authContext?: unknown;
  excludePictureId?: string;
}

export type ProbeAllPoolForUnplayedResult =
  | { status: 'unplayed' }
  | { status: 'exhausted' }
  | { status: 'indeterminate'; reason?: 'network' | 'server' | 'probe-cap' | 'played-out' };

export const PROBE_MAX_BATCHES: number;
export function probeAllPoolForUnplayed(args?: ProbeAllPoolForUnplayedArgs): Promise<ProbeAllPoolForUnplayedResult>;

export function fetchCardBatch(args?: FetchCardBatchArgs): Promise<FetchCardBatchResult>;
// Fix 3: both write boundaries return their persisted result — the merged/
// normalized deck that callers (SwipeImage.handleData) use as the numbering
// source of truth.
export function appendCardBatch(args?: AppendCardBatchArgs): Promise<CardImage[]>;
export function persistCardBatch(args?: PersistCardBatchArgs): Promise<CardImage[]>;
export function removeCardFromGroupDeck(args?: RemoveCardFromGroupDeckArgs): Promise<void>;
