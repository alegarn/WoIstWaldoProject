import { getItem, setItem, removeItem } from './localStore';
import { submitScoreBatch } from './scoreRequests';
import { isE2EMode } from './e2eMode';

/**
 * Pending score events buffered over the `utils/localStore` seam under the
 * `pendingScoreEvents` key. The shape is written by
 * `utils/handleGuessOutcome.ts` and read back by `flush`/`getPending`.
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

const PENDING_SCORE_EVENTS_KEY = 'pendingScoreEvents';

let writeChain: Promise<void> = Promise.resolve();
let flushing = false;
let pendingFlush: Promise<FlushResult> | null = null;

function groupByScope(items: PendingScoreItem[]): PendingScoreItem[][] {
  const publicBucket: PendingScoreItem[] = [];
  const privateGroups = new Map<unknown, PendingScoreItem[]>();

  for (const item of items) {
    const scope = (item && item.scope) as { kind?: unknown; groupId?: unknown } | undefined;
    if (scope && scope.kind === 'private' && scope.groupId) {
      const key = scope.groupId;
      const bucket = privateGroups.get(key);
      if (!bucket) {
        privateGroups.set(key, [item]);
      } else {
        bucket.push(item);
      }
    } else {
      publicBucket.push(item);
    }
  }

  const groups: PendingScoreItem[][] = [];
  if (publicBucket.length > 0) {
    groups.push(publicBucket);
  }
  for (const group of privateGroups.values()) {
    groups.push(group);
  }
  return groups;
}

export function mintGuessId(): string {
  const fillRandom = (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function')
    ? (bytes: Uint8Array): Uint8Array => crypto.getRandomValues(bytes)
    : (bytes: Uint8Array): Uint8Array => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    };

  const bytes = new Uint8Array(16);
  fillRandom(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

async function readList(): Promise<PendingScoreItem[]> {
  const stored = await getItem(PENDING_SCORE_EVENTS_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as PendingScoreItem[]) : [];
  } catch {
    return [];
  }
}

async function writeList(items: PendingScoreItem[]): Promise<void> {
  await setItem(PENDING_SCORE_EVENTS_KEY, JSON.stringify(items));
}

function mutateList(
  fn: (list: PendingScoreItem[]) => Promise<PendingScoreItem[] | void> | PendingScoreItem[] | void
): Promise<void> {
  writeChain = writeChain.then(async () => {
    const list = await readList();
    const next = await fn(list);
    await writeList(next === undefined ? list : next);
  });
  return writeChain;
}

export function bufferScore(item: PendingScoreItem): Promise<void> {
  const normalized = item && typeof item === 'object'
    ? { ...item, ts: item.ts ?? Date.now() }
    : item;

  writeChain = mutateList((list) => {
    list.push(normalized);
  }).catch(() => {});

  return writeChain;
}

export async function getPending(): Promise<PendingScoreItem[]> {
  return await readList();
}

export async function clearPending(): Promise<void> {
  await removeItem(PENDING_SCORE_EVENTS_KEY);
}

export async function flush({ authContext }: { authContext?: unknown }): Promise<FlushResult> {
  if (isE2EMode()) {
    writeChain = writeChain.then(async () => {
      await clearPending();
    });
    await writeChain;
    return { ok: true, sent: 0, retained: 0 };
  }

  if (flushing) {
    return pendingFlush as Promise<FlushResult>;
  }

  flushing = true;

  pendingFlush = (async (): Promise<FlushResult> => {
    let result: FlushResult = { ok: true, sent: 0, retained: 0 };

    try {
      writeChain = writeChain
        .then(async () => {
          const items = await readList();
          if (!items || items.length === 0) {
            result = { ok: true, sent: 0, retained: 0 };
            return;
          }

          const currentUserId = (authContext as { userId?: unknown } | null | undefined)?.userId;
          const owned = (item: PendingScoreItem): boolean => item.userId == null || item.userId === currentUserId;
          const mine = items.filter(owned);
          const others = items.filter((item) => !owned(item));

          if (mine.length === 0) {
            result = { ok: true, sent: 0, retained: others.length };
            return;
          }

          await writeList(others);

          const groups = groupByScope(mine);

          let sent = 0;
          let retained = 0;
          let allOk = true;

          for (const group of groups) {
            let ok = false;
            try {
              ok = await submitScoreBatch({ items: group, context: authContext });
            } catch {
              ok = false;
            }
            if (ok) {
              sent += group.length;
            } else {
              allOk = false;
              retained += group.length;
              const reBufferItems = group.slice();
              writeChain = mutateList((list) => {
                for (const item of reBufferItems) {
                  list.push(item);
                }
              }).catch(() => {});
            }
          }

          result = { ok: allOk, sent, retained };
        })
        .catch(() => {
          result = { ok: false, sent: 0, retained: 0 };
        });

      await writeChain;
      return result;
    } finally {
      flushing = false;
      pendingFlush = null;
    }
  })();

  return pendingFlush;
}
