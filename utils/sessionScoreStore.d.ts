/**
 * Type declarations for `utils/sessionScoreStore.js`. The runtime module is
 * plain JavaScript; these declarations pin the buffered-event shape written
 * by `utils/handleGuessOutcome.ts` and read back by `flush`/`getPending`.
 * Items are persisted JSON, so consumer-unknown fields stay open via the
 * index signature.
 */

export interface PendingScoreItem {
  guessId?: string;
  imageName?: string | null;
  imageId?: string | null;
  pictureId?: string | null;
  scope?: unknown;
  points?: number;
  multiplier?: number;
  streak?: number;
  streakMultiplier?: number;
  ts?: number;
  userId?: unknown;
  [key: string]: unknown;
}

export interface FlushResult {
  ok: boolean;
  sent: number;
  retained: number;
}

export function mintGuessId(): string;
export function bufferScore(item: PendingScoreItem): Promise<void>;
export function getPending(): Promise<PendingScoreItem[]>;
export function clearPending(): Promise<void>;
export function flush({ authContext }: { authContext?: unknown }): Promise<FlushResult>;
