jest.mock('../utils/storageDatum', () => {
  const actual = jest.requireActual('../utils/storageDatum');
  return {
    ...actual,
    PUBLIC_FEED_END_CURSOR: '__public_feed_end__',
    getLastImageUuid: jest.fn(),
    storeImageList: jest.fn(),
    updateImageList: jest.fn(),
    clearExhaustedCategory: jest.fn((categoryKey, language, scope) =>
      actual.clearExhaustedCategory(categoryKey, language, scope)),
  };
});

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => ({
  readGroupFeedCache: jest.fn(),
  writeGroupFeedCache: jest.fn(),
  clearGroupCategoryExhausted: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearExhaustedCategory, getLastImageUuid, storeImageList, updateImageList } from '../utils/storageDatum';
import { getImages } from '../utils/imagesRequests';
import { clearGroupCategoryExhausted, readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { appendCardBatch, fetchCardBatch, persistCardBatch, removeCardFromGroupDeck } from '../services/cardDeck';

const realUpdateImageList = jest.requireActual('../utils/storageDatum').updateImageList;

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

  it('(e) returns the merged deck for both scopes — callers use it as the numbering source of truth (Fix 3)', async () => {
    updateImageList.mockResolvedValueOnce([{ listId: 1 }, { listId: 2 }]);

    await expect(
      appendCardBatch({ cards: [{ listId: 2 }], categoryKey: 'all', language: 'fr', scope: { kind: 'public' } }),
    ).resolves.toEqual([{ listId: 1 }, { listId: 2 }]);

    readGroupFeedCache.mockResolvedValueOnce({ images: [{ listId: 1 }], nextCursor: null });

    await expect(
      appendCardBatch({
        cards: [{ pictureId: 'x' }],
        categoryKey: 'all',
        categoryId: 'all',
        language: 'fr',
        scope: { kind: 'private', groupId: 'g-3' },
      }),
    ).resolves.toEqual([{ listId: 1 }, { pictureId: 'x', listId: 2 }]);
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

describe('appendCardBatch pictureId dedup (RC10/T4.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
  });

  it('does NOT append a card whose pictureId is already in the private deck', async () => {
    // RC10/T4.3: the server can re-serve a card already in the local deck
    // (stale cursor). Without pictureId dedup, the duplicate gets a NEW
    // listId > currentListId and getNextImage returns it → the just-played
    // card repeats. Drop duplicates by pictureId before normalizeListIds.
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1, pictureId: 'card-A' }],
      nextCursor: null,
    });
    const cards = [{ pictureId: 'card-A' }, { pictureId: 'card-B' }];

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
          { listId: 1, pictureId: 'card-A' },
          { pictureId: 'card-B', listId: 2 },
        ],
        nextCursor: null,
      },
    );
  });

  it('appends cards with undefined pictureId (legacy) without dropping them', async () => {
    // Legacy server payloads may omit pictureId. There is no key to dedup
    // against, so dropping them would lose data — they must pass through.
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1, pictureId: 'card-A' }],
      nextCursor: null,
    });
    const cards = [{ pictureId: undefined }, { pictureId: 'card-B' }];

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
          { listId: 1, pictureId: 'card-A' },
          { pictureId: undefined, listId: 2 },
          { pictureId: 'card-B', listId: 3 },
        ],
        nextCursor: null,
      },
    );
  });

  it('preserves the existing card listId when a duplicate pictureId arrives', async () => {
    // The existing card keeps its assigned listId; the duplicate is dropped
    // (NOT re-normalized to a new listId, which would shadow the original).
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 5, pictureId: 'card-A' }],
      nextCursor: null,
    });
    const cards = [{ pictureId: 'card-A' }, { pictureId: 'card-B' }];

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
          { listId: 5, pictureId: 'card-A' },
          { pictureId: 'card-B', listId: 6 },
        ],
        nextCursor: null,
      },
    );
  });

  it('does NOT append a card whose pictureId is already in the public deck', async () => {
    // Public scope: appendCardBatch delegates to updateImageList, so the
    // dedup must live in updateImageList (the storage-write boundary). Use
    // the REAL updateImageList against AsyncStorage mocks to verify the
    // post-append deck has no pictureId duplicate.
    updateImageList.mockImplementation(realUpdateImageList);
    // Fix 2b: appendCardBatch now reads the played-set (filterPlayedCards)
    // BEFORE updateImageList reads the deck — feed the played read first.
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify([{ listId: 1, pictureId: 'card-A' }]),
    );
    AsyncStorage.setItem.mockResolvedValue(undefined);
    const cards = [{ pictureId: 'card-A' }, { pictureId: 'card-B' }];

    await appendCardBatch({
      cards,
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'public' },
    });

    const writtenPayload = AsyncStorage.setItem.mock.calls[0][1];
    const writtenImages = JSON.parse(writtenPayload);
    const pictureIds = writtenImages.map((c) => c.pictureId);
    expect(pictureIds).toEqual(['card-A', 'card-B']);
    expect(new Set(pictureIds).size).toBe(pictureIds.length);
  });
});

describe('removeCardFromGroupDeck (Fix 1 D1 private path)', () => {
  const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
  });

  it('removes only the target listId from the persisted private deck and preserves nextCursor', async () => {
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1 }, { listId: 2 }, { listId: 3 }],
      nextCursor: { page: 2 },
    });

    await removeCardFromGroupDeck({
      groupId: 'g-3',
      categoryId: 7,
      language: 'fr',
      listId: 2,
    });

    expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: 7, language: 'fr' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ listId: 1 }, { listId: 3 }], nextCursor: { page: 2 } },
    );
  });

  it('serializes with appendCardBatch on the same private deck key', async () => {
    let store = {
      images: [{ listId: 1 }, { listId: 2 }],
      nextCursor: 'cursor-1',
    };
    let releaseFirstWrite;
    const firstWriteGate = new Promise((resolve) => {
      releaseFirstWrite = resolve;
    });
    let firstWriteGated = false;

    readGroupFeedCache.mockImplementation(async () => ({
      images: [...store.images],
      nextCursor: store.nextCursor,
    }));

    writeGroupFeedCache.mockImplementation(async (_groupId, _meta, payload) => {
      if (!firstWriteGated) {
        firstWriteGated = true;
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

    const append = appendCardBatch({ ...sharedArgs, cards: [{ listId: 3 }] });
    await flushMicrotasks();
    await flushMicrotasks();

    const removal = removeCardFromGroupDeck({
      groupId: 'g-lock',
      categoryId: 'all',
      language: 'fr',
      listId: 1,
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(readGroupFeedCache).toHaveBeenCalledTimes(1);

    releaseFirstWrite();
    await append;
    await removal;

    expect(store).toEqual({
      images: [{ listId: 2 }, { listId: 3 }],
      nextCursor: 'cursor-1',
    });
  });

  it('is a no-op when the private cache is missing', async () => {
    readGroupFeedCache.mockResolvedValueOnce(null);

    await expect(removeCardFromGroupDeck({
      groupId: 'g-3',
      categoryId: 7,
      language: 'fr',
      listId: 2,
    })).resolves.toBeUndefined();

    expect(writeGroupFeedCache).not.toHaveBeenCalled();
  });
});

describe('exhausted-marker invalidation (Fix 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
    clearGroupCategoryExhausted.mockResolvedValue(undefined);
  });

  it('appendCardBatch with non-empty non-"all" batch clears exhausted marker (public)', async () => {
    await appendCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(clearExhaustedCategory).toHaveBeenCalledWith('city', 'fr', { kind: 'public' });
  });

  it('persistCardBatch non-empty non-"all" clears marker', async () => {
    await persistCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(clearExhaustedCategory).toHaveBeenCalledWith('city', 'fr', { kind: 'public' });
  });

  it('categoryKey "all" never clears', async () => {
    await appendCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'all',
      language: 'fr',
      scope: { kind: 'public' },
    });
    await persistCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'all',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(clearExhaustedCategory).not.toHaveBeenCalled();
  });

  it('empty batch does not clear', async () => {
    await appendCardBatch({
      cards: [],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });
    await persistCardBatch({
      cards: [],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(clearExhaustedCategory).not.toHaveBeenCalled();
  });

  it('private scope routes to group clear (clearGroupCategoryExhausted via mocked storageDatum)', async () => {
    await appendCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(clearExhaustedCategory).toHaveBeenCalledWith('city', 'fr', { kind: 'private', groupId: 'g-3' });
    expect(clearGroupCategoryExhausted).toHaveBeenCalledWith('g-3', 'city', 'fr');
  });

  it('clear failure does not reject the append (Fix 3: resolves the updateImageList deck)', async () => {
    clearExhaustedCategory.mockRejectedValueOnce(new Error('storage clear failed'));

    await expect(
      appendCardBatch({
        cards: [{ listId: 1 }],
        categoryKey: 'city',
        language: 'fr',
        scope: { kind: 'public' },
      }),
    ).resolves.toEqual([]);

    expect(updateImageList).toHaveBeenCalledWith([{ listId: 1 }], 'city', 'fr');
  });
});

describe('appendCardBatch played-set filter (Fix 2b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('(j) drops incoming cards whose pictureId is in the played-set (public + private branches)', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['played-1']));

    await appendCardBatch({
      cards: [{ pictureId: 'played-1' }, { pictureId: 'fresh-1' }],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
    expect(updateImageList).toHaveBeenCalledWith([{ pictureId: 'fresh-1' }], 'city', 'fr');

    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['played-1']));

    await appendCardBatch({
      cards: [{ pictureId: 'played-1' }, { pictureId: 'fresh-2' }],
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('playedPictureIds:group:g-3:fr');
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ pictureId: 'fresh-2', listId: 1 }], nextCursor: null },
    );
  });

  it('(k) incoming cards without a pictureId pass the played-set filter', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['played-1']));

    await appendCardBatch({
      cards: [{ listId: 9 }, { pictureId: 'fresh-1' }],
      categoryKey: 'city',
      language: 'fr',
      scope: { kind: 'public' },
    });

    expect(updateImageList).toHaveBeenCalledWith([{ listId: 9 }, { pictureId: 'fresh-1' }], 'city', 'fr');
  });

  it('played-set read failure does not reject the append (cards pass through)', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('played read failed'));

    await expect(
      appendCardBatch({
        cards: [{ pictureId: 'fresh-1' }],
        categoryKey: 'city',
        language: 'fr',
        scope: { kind: 'public' },
      }),
    ).resolves.toEqual([]);

    expect(updateImageList).toHaveBeenCalledWith([{ pictureId: 'fresh-1' }], 'city', 'fr');
  });
});

describe('batch return contracts (Fix 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
  });

  it('(f) persistCardBatch writes and returns normalized cards (ids 1..n on a fresh deck, both scopes)', async () => {
    await expect(persistCardBatch({
      cards: [{ pictureId: 'a' }, { pictureId: 'b' }, { pictureId: 'c' }],
      categoryKey: 'all',
      language: 'fr',
      scope: { kind: 'public' },
    })).resolves.toEqual([
      { pictureId: 'a', listId: 1 },
      { pictureId: 'b', listId: 2 },
      { pictureId: 'c', listId: 3 },
    ]);
    expect(storeImageList).toHaveBeenCalledWith([
      { pictureId: 'a', listId: 1 },
      { pictureId: 'b', listId: 2 },
      { pictureId: 'c', listId: 3 },
    ], 'all', 'fr');

    await expect(persistCardBatch({
      cards: [{ pictureId: 'p' }],
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    })).resolves.toEqual([{ pictureId: 'p', listId: 1 }]);
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      { images: [{ pictureId: 'p', listId: 1 }], nextCursor: null },
    );
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
      expect.objectContaining({ language: undefined, category_key: 'nature' }),
    );
    // B2: PUBLIC scope must NOT send category_id (bundled keys replace UUIDs).
    expect(getImages.mock.calls[0][2]).not.toHaveProperty('category_id');
    expect(getImages.mock.calls[0][2].language).not.toBe('any');
  });

  it('B2: PUBLIC scope sends category_key only; PRIVATE scope keeps category_id', async () => {
    // PUBLIC: categoryKey threads through as category_key; categoryId is
    // dropped (bundled public categories carry no server UUID anymore).
    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
    });
    const publicFilters = getImages.mock.calls[0][2];
    expect(publicFilters).toMatchObject({ category_key: 'nature' });
    expect(publicFilters).not.toHaveProperty('category_id');

    jest.clearAllMocks();
    getLastImageUuid.mockResolvedValue(null);
    getImages.mockResolvedValue({ isError: false, images: [] });

    // PRIVATE: categoryId threads through as category_id (UUID unchanged); no
    // category_key leaks on the private path (byte-equivalent to pre-B2).
    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-private-uuid',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-1' },
      authContext: { token: 't' },
    });
    const privateFilters = getImages.mock.calls[0][2];
    expect(privateFilters).toMatchObject({ category_id: 'cat-private-uuid' });
    expect(privateFilters).not.toHaveProperty('category_key');
  });

  it('private cursor round-trip: reads the persisted cursor under the group-scoped namespace', async () => {
    // Regression (F1/F2 review fix): buildFeedFilters omits category_key for
    // private scopes, so the write path (getImages → fetchPrivateFeedPageForGame)
    // derives the cursor category from category_id and persists under the
    // group-scoped key. The READ side must query the SAME (categoryKey,
    // language, scope) tuple or the private cursor never round-trips and
    // pagination stalls at page 1.
    await fetchCardBatch({
      categoryKey: 'cat-private-uuid',
      categoryId: 'cat-private-uuid',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-1' },
      authContext: { token: 't' },
    });

    expect(getLastImageUuid).toHaveBeenCalledWith('cat-private-uuid', 'fr', { kind: 'private', groupId: 'g-1' });
    expect(getImages.mock.calls[0][2]).toMatchObject({ category_id: 'cat-private-uuid' });
  });

  it('private sentinel passes through uncoerced (asymmetry: only the PUBLIC sentinel is coerced to a head fetch)', async () => {
    // The PRIVATE_FEED_END_CURSOR is consumed by fetchPrivateFeedPageForGame's
    // exhausted short-circuit — cardDeck must NOT coerce it to null the way it
    // coerces the PUBLIC sentinel (legacy public self-heal). Reading it
    // uncoerced keeps the sentinel semantics scope-correct.
    getLastImageUuid.mockResolvedValue('__private_feed_end__');

    await fetchCardBatch({
      categoryKey: 'cat-private-uuid',
      categoryId: 'cat-private-uuid',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-1' },
      authContext: { token: 't' },
      // pictureIdOverride intentionally omitted (cursor-mode)
    });

    expect(getImages.mock.calls[0][0]).toBe('__private_feed_end__');
    expect(getImages.mock.calls[0]).toHaveLength(3);
  });

  it('B2: PUBLIC "all" pseudo-category sends neither category_key nor category_id', async () => {
    await fetchCardBatch({
      categoryKey: 'all',
      categoryId: undefined,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
    });

    const filters = getImages.mock.calls[0][2];
    expect(filters).not.toHaveProperty('category_key');
    expect(filters).not.toHaveProperty('category_id');
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

describe('fetchCardBatch head-replay detection (Fix 2a)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLastImageUuid.mockResolvedValue(null);
    getImages.mockResolvedValue({ isError: false, images: [] });
  });

  it('(a) real stored cursor + null override → getImages opts { persistCursor: false } (head replay must not rewind)', async () => {
    getLastImageUuid.mockResolvedValue('real-cursor-uuid');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      pictureIdOverride: null,
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
      { persistCursor: false },
    );
  });

  it('(b) PUBLIC_FEED_END_CURSOR sentinel + null override → same head-replay opt-out', async () => {
    getLastImageUuid.mockResolvedValue('__public_feed_end__');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      pictureIdOverride: null,
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
      { persistCursor: false },
    );
  });

  it('(c) PRIVATE_FEED_END_CURSOR sentinel + null override → same head-replay opt-out', async () => {
    getLastImageUuid.mockResolvedValue('__private_feed_end__');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      pictureIdOverride: null,
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
      { persistCursor: false },
    );
  });

  it('(d) no stored cursor + null override → 3-arg call (initial fill persists the head tail as cursor)', async () => {
    getLastImageUuid.mockResolvedValue(null);

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      pictureIdOverride: null,
    });

    expect(getImages.mock.calls[0]).toHaveLength(3);
    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
    );
  });

  it('(e) sentinel + omitted override → 3-arg call (sentinel un-stick keeps persisting)', async () => {
    getLastImageUuid.mockResolvedValue('__public_feed_end__');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      // pictureIdOverride intentionally omitted (cursor-mode sentinel coercion)
    });

    expect(getImages.mock.calls[0]).toHaveLength(3);
    expect(getImages).toHaveBeenCalledWith(
      null,
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
    );
  });

  it('(f) explicit uuid override → 3-arg call even with a stored cursor (explicit-uuid fetch unchanged)', async () => {
    getLastImageUuid.mockResolvedValue('real-cursor-uuid');

    await fetchCardBatch({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 't' },
      pictureIdOverride: 'explicit-uuid',
    });

    expect(getImages.mock.calls[0]).toHaveLength(3);
    expect(getImages).toHaveBeenCalledWith(
      'explicit-uuid',
      { token: 't' },
      expect.objectContaining({ category_key: 'nature' }),
    );
  });
});
