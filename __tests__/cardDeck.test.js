jest.mock('../utils/storageDatum', () => {
  const actual = jest.requireActual('../utils/storageDatum');
  return {
    ...actual,
    PUBLIC_FEED_END_CURSOR: '__public_feed_end__',
    getLastImageUuid: jest.fn(),
    storeImageList: jest.fn(),
    updateImageList: jest.fn(),
  };
});

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => ({
  readGroupFeedCache: jest.fn(),
  writeGroupFeedCache: jest.fn(),
}));

import { getLastImageUuid, updateImageList } from '../utils/storageDatum';
import { getImages } from '../utils/imagesRequests';
import { readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { appendCardBatch, fetchCardBatch } from '../services/cardDeck';

describe('appendCardBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
  });

  it('delegates to updateImageList on the public scope and skips the group feed cache', async () => {
    const cards = [{ listId: 1 }, { listId: 2 }];

    await appendCardBatch({ cards, categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' } });

    expect(updateImageList).toHaveBeenCalledWith(cards, 'city', 'fr');
    expect(writeGroupFeedCache).not.toHaveBeenCalled();
    expect(readGroupFeedCache).not.toHaveBeenCalled();
  });

  it('reads, concatenates, and writes the merged deck on the private scope without calling updateImageList', async () => {
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1 }, { listId: 2 }],
      nextCursor: 'cursor-1',
    });
    const cards = [{ listId: 3 }, { listId: 4 }];

    await appendCardBatch({
      cards,
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: 7, language: 'fr' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ listId: 1 }, { listId: 2 }, { listId: 3 }, { listId: 4 }], nextCursor: 'cursor-1' },
    );
    expect(updateImageList).not.toHaveBeenCalled();
  });

  it('writes the incoming cards as-is when the private cache is empty or missing', async () => {
    readGroupFeedCache.mockResolvedValueOnce(null);
    const cards = [{ listId: 5 }];

    await appendCardBatch({
      cards,
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      { images: [{ listId: 5 }], nextCursor: null },
    );
  });

  it('preserves the existing nextCursor when appending to a private cache', async () => {
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1 }],
      nextCursor: { page: 2 },
    });

    await appendCardBatch({
      cards: [{ listId: 2 }],
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ listId: 1 }, { listId: 2 }], nextCursor: { page: 2 } },
    );
  });

  it('returns null to match persistCardBatch', async () => {
    await expect(
      appendCardBatch({ cards: [], categoryKey: 'all', language: 'fr', scope: { kind: 'public' } }),
    ).resolves.toBe(null);

    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
    await expect(
      appendCardBatch({ cards: [], categoryKey: 'all', language: 'fr', scope: { kind: 'private', groupId: 'g-3' } }),
    ).resolves.toBe(null);
  });

  it('normalizes an undefined language to "any" before forwarding to delegates', async () => {
    const cards = [{ listId: 1 }];

    await appendCardBatch({ cards, categoryKey: 'all', scope: { kind: 'public' } });

    expect(updateImageList).toHaveBeenCalledWith(cards, 'all', 'any');

    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
    await appendCardBatch({
      cards,
      categoryKey: 'all',
      scope: { kind: 'private', groupId: 'g-9' },
    });

    expect(readGroupFeedCache).toHaveBeenLastCalledWith('g-9', { categoryId: undefined, language: 'any' });
    expect(writeGroupFeedCache).toHaveBeenLastCalledWith(
      'g-9',
      { categoryId: undefined, language: 'any' },
      { images: cards, nextCursor: null },
    );
  });

  it('resolves an "all" categoryId to undefined for both private and public scopes', async () => {
    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });

    await appendCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: undefined, language: 'fr' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      expect.objectContaining({ images: [{ listId: 1 }] }),
    );
  });

  it('private-scope appendCardBatch normalizes missing listIds (server cards without listId become resolvable)', async () => {
    readGroupFeedCache.mockResolvedValueOnce({ images: [{ listId: 1 }], nextCursor: null });
    const cards = [{ uuid: 'a' }, { uuid: 'b', listId: 'oops' }];

    await appendCardBatch({
      cards,
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      {
        images: [
          { listId: 1 },
          { uuid: 'a', listId: 2 },
          { uuid: 'b', listId: 3 },
        ],
        nextCursor: null,
      },
    );
  });

  it('concurrent appendCardBatch calls for same scope → serialized (no lost update; deck size = sum of both batches)', async () => {
    // R2 regression guard. The private-scope path performs its RMW
    // (read → concat → write) inside appendCardBatch, so we can observe
    // serialization by backing read/writeGroupFeedCache with shared in-memory
    // state. The first call's write is held open via a deferred to widen the
    // window; the second call must not read until the first's write settles.
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

    let store = { images: [], nextCursor: null };
    let releaseFirstWrite;
    const firstWriteGate = new Promise((resolve) => {
      releaseFirstWrite = resolve;
    });

    readGroupFeedCache.mockImplementation(async () => ({
      images: [...store.images],
      nextCursor: store.nextCursor,
    }));

    writeGroupFeedCache.mockImplementation(async (_groupId, _meta, payload) => {
      if (store.images.length === 0) {
        await firstWriteGate;
      }
      store = { images: payload.images, nextCursor: payload.nextCursor };
    });

    const sharedArgs = {
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-lock' },
    };

    const call1 = appendCardBatch({ ...sharedArgs, cards: [{ listId: 1 }, { listId: 2 }] });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(writeGroupFeedCache).toHaveBeenCalledTimes(1);

    const call2 = appendCardBatch({ ...sharedArgs, cards: [{ listId: 3 }, { listId: 4 }] });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(readGroupFeedCache).toHaveBeenCalledTimes(1);

    releaseFirstWrite();
    await call1;
    await call2;

    expect(writeGroupFeedCache).toHaveBeenCalledTimes(2);
    expect(store.images).toEqual([
      { listId: 1 },
      { listId: 2 },
      { listId: 3 },
      { listId: 4 },
    ]);
  });
});

describe('fetchCardBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLastImageUuid.mockResolvedValue(null);
    getImages.mockResolvedValue({ isError: false, images: [] });
  });

  it('normalizes a synthetic "any" language to undefined so the backend does not filter by a non-existent language code', async () => {
    // Regression: GuessPathScreen passes navigationLanguage='any' when the user
    // never opened the language filter. That literal flowed all the way to the
    // backend as ?language=any, and Image.batch_with_existing_storage applied
    // WHERE language='any' — matching zero rows (no image has language='any').
    // Categories with otherwise-matching cards appeared permanently empty.
    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'any',
      scope: { kind: 'public' },
      authContext: { token: 't' },
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ language: undefined, category_key: 'nature', category_id: 'cat-nature' }),
    );
    expect(getImages.mock.calls[0][2].language).not.toBe('any');
  });

  it('forwards a real language code untouched', async () => {
    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ language: 'fr' }),
    );
  });

  it('normalizes an undefined language to undefined on the server (parity with the any/undefined branch)', async () => {
    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: undefined,
      scope: { kind: 'public' },
      authContext: { token: 't' },
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ language: undefined }),
    );
    expect(getImages.mock.calls[0][2].language).not.toBe('any');
  });

  it('treats a legacy stored exhausted sentinel as a fresh cursor so pictureIdOverride===undefined paths self-heal', async () => {
    // Regression: prior app versions persisted PUBLIC_FEED_END_CURSOR to mark a
    // category exhausted. After the brick fix, the cold-mount path bypasses the
    // cursor (always passes null), but refillOrFallback's foreground load and
    // the background prefetcher still call fetchCardBatch with no override —
    // which used to read the stale sentinel and POST {name:'__public_feed_end__'}
    // to the backend every session. Treat the sentinel as null so those paths
    // also re-query from head and overwrite the stale key with a real cursor.
    getLastImageUuid.mockResolvedValue('__public_feed_end__');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      // pictureIdOverride intentionally omitted (refillOrFallback / prefetcher shape)
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
    );
  });
});
