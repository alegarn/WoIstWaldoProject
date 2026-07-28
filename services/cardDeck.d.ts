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
  | { isError: false; images: CardImage[] };

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

export function fetchCardBatch(args?: FetchCardBatchArgs): Promise<FetchCardBatchResult>;
export function appendCardBatch(args?: AppendCardBatchArgs): Promise<null>;
export function persistCardBatch(args?: PersistCardBatchArgs): Promise<null>;
