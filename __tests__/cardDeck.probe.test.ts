jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../services/groups/groupFeedApi', () => ({
  PRIVATE_FEED_END_CURSOR: '__private_feed_end__',
}));

jest.mock('../services/groups/groupFeedCache', () => {
  const actual = jest.requireActual('../services/groups/groupFeedCache');
  return {
    ...actual,
    readGroupFeedCache: jest.fn(),
    writeGroupFeedCache: jest.fn(),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImages } from '../utils/imagesRequests';
import { readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { saveLastImageUuid } from '../utils/storageDatum';
import { probeAllPoolForUnplayed } from '../services/cardDeck';

const mockAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.MockedFunction<(key: string) => Promise<string | null>>;
  setItem: jest.MockedFunction<(key: string, value: string) => Promise<void>>;
  removeItem: jest.MockedFunction<(key: string) => Promise<void>>;
  getAllKeys: jest.MockedFunction<() => Promise<readonly string[]>>;
  multiRemove: jest.MockedFunction<(keys: readonly string[]) => Promise<void>>;
};

const mockGetImages = getImages as unknown as jest.Mock;

type Store = Map<string, string>;

function mockStore(initial: Record<string, string> = {}): Store {
  const store: Store = new Map(Object.entries(initial));
  mockAsyncStorage.getItem.mockImplementation(async (key: string) => store.get(key) ?? null);
  mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  mockAsyncStorage.removeItem.mockImplementation(async (key: string) => {
    store.delete(key);
  });
  mockAsyncStorage.getAllKeys.mockImplementation(async () => Array.from(store.keys()));
  mockAsyncStorage.multiRemove.mockImplementation(async (keys: readonly string[]) => {
    keys.forEach((key) => store.delete(key));
  });
  return store;
}

type Card = { pictureId: string; imageFile: string };

function batch(prefix: string, count: number): Card[] {
  return Array.from({ length: count }, (_, i) => ({
    pictureId: `${prefix}${i + 1}`,
    imageFile: `file:///cache/${prefix}${i + 1}.jpg`,
  }));
}

function pictureIds(cards: Array<{ pictureId?: string }>): string[] {
  return cards.map((c) => c.pictureId);
}

/**
 * Cursor-mode server + transport-persistence simulation: serves the batch
 * AFTER the cursor's tail (head batch when pictureId is null), and persists
 * the served batch's tail through the REAL saveLastImageUuid (same contract
 * as utils/imagesRequests.getImages — non-empty batch → cursor advance;
 * opts.persistCursor === false → head replay, no write).
 */
function mockCursorServer(batches: Card[][]) {
  mockGetImages.mockImplementation(async (pictureId: string | null, _ctx: unknown, filters: { language?: string; scope?: unknown }, ...rest: unknown[]) => {
    const opts = rest[0] as { persistCursor?: boolean } | undefined;
    const index = pictureId === null
      ? 0
      : batches.findIndex((b) => b.length > 0 && b[b.length - 1].pictureId === pictureId) + 1;
    const served = batches[index];
    if (!served || served.length === 0) {
      return { isError: false, reason: 'empty', images: [] };
    }
    if (opts?.persistCursor !== false) {
      await saveLastImageUuid(served[served.length - 1].pictureId, 'all', filters?.language, filters?.scope ?? null);
    }
    return { isError: false, images: served };
  });
}

const PUBLIC_ARGS = { language: 'fr', scope: { kind: 'public' }, authContext: { token: 't' } };

describe('probeAllPoolForUnplayed (sound exhaustion proof, Steps 1+2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore();
    mockGetImages.mockReset();
    readGroupFeedCache.mockResolvedValue(null);
    writeGroupFeedCache.mockResolvedValue(undefined);
  });

  it('all-played batch pages forward, later unplayed batch appends to the "all" deck, cursor advances, no servingCycle writes', async () => {
    const b2 = batch('played-', 2);
    const b3 = batch('fresh-', 3);
    const store = mockStore({
      'lastImageUuid:all:fr': 'row-5-cursor',
      'playedPictureIds:public:fr': JSON.stringify(pictureIds(b2)),
    });
    mockCursorServer([batch('old-', 5), b2, b3]);
    // The stored cursor must be the tail of batch 1 for the server mock.
    const b1 = batch('old-', 5);
    store.set('lastImageUuid:all:fr', b1[4].pictureId);

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'unplayed' });
    expect(mockGetImages).toHaveBeenCalledTimes(2);
    expect(mockGetImages.mock.calls[0][0]).toBe(b1[4].pictureId);
    expect(mockGetImages.mock.calls[1][0]).toBe(b2[1].pictureId);
    expect(store.get('lastImageUuid:all:fr')).toBe(b3[2].pictureId);
    const deck = JSON.parse(store.get('imageList:all:fr') ?? '[]');
    expect(pictureIds(deck)).toEqual(pictureIds(b3));
    expect(Array.from(store.keys()).every((key) => !key.startsWith('servingCycle:'))).toBe(true);
    expect(
      mockAsyncStorage.setItem.mock.calls.filter(([key]) => key.startsWith('servingCycle:')),
    ).toHaveLength(0);
  });

  it('drains to an empty batch → exhausted (server-proven pool drain)', async () => {
    const b2 = batch('played-', 2);
    const store = mockStore({
      'playedPictureIds:public:fr': JSON.stringify(pictureIds(b2)),
    });
    const b1 = batch('old-', 5);
    store.set('lastImageUuid:all:fr', b1[4].pictureId);
    mockCursorServer([b1, b2]);

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'exhausted' });
    expect(store.get('lastImageUuid:all:fr')).toBe(b2[1].pictureId);
    expect(store.has('imageList:all:fr')).toBe(false);
  });

  it('public sentinel: cleared before the first fetch, which is then a head fetch with cursor persist', async () => {
    const store = mockStore({
      'lastImageUuid:all:fr': '__public_feed_end__',
    });
    const b1 = batch('head-', 3);
    mockCursorServer([b1]);

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'unplayed' });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('lastImageUuid:all:fr');
    expect(mockGetImages.mock.calls[0][0]).toBeNull();
    expect(mockGetImages.mock.calls[0]).toHaveLength(3);
    expect(store.get('lastImageUuid:all:fr')).toBe(b1[2].pictureId);
  });

  it('private sentinel: cleared under the group-scoped key before the first fetch, which is then a head fetch', async () => {
    const scope = { kind: 'private', groupId: 'g-1' };
    const store = mockStore({
      'groupFeed:g-1:game:all:fr:cursor': '__private_feed_end__',
    });
    const b1 = batch('priv-', 3);
    mockCursorServer([b1]);

    const result = await probeAllPoolForUnplayed({ language: 'fr', scope, authContext: { token: 't' } });

    expect(result).toEqual({ status: 'unplayed' });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('groupFeed:g-1:game:all:fr:cursor');
    expect(mockGetImages.mock.calls[0][0]).toBeNull();
    expect(mockGetImages.mock.calls[0]).toHaveLength(3);
    expect(store.get('groupFeed:g-1:game:all:fr:cursor')).toBe(b1[2].pictureId);
  });

  it('fetch error → indeterminate, cursor untouched, no deck write', async () => {
    const b1 = batch('old-', 5);
    const store = mockStore({
      'lastImageUuid:all:fr': b1[4].pictureId,
    });
    mockGetImages.mockResolvedValue({ isError: true, reason: 'network' });

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'indeterminate', reason: 'network' });
    expect(mockGetImages).toHaveBeenCalledTimes(1);
    expect(store.get('lastImageUuid:all:fr')).toBe(b1[4].pictureId);
    expect(store.has('imageList:all:fr')).toBe(false);
  });

  it('PROBE_MAX_BATCHES all-played batches → indeterminate probe-cap (fail open)', async () => {
    const played = batch('p', 1);
    const batches = Array.from({ length: 20 }, (_, i) => [{ ...played[0], pictureId: `cap-${i}` }]);
    const store = mockStore({
      'playedPictureIds:public:fr': JSON.stringify(pictureIds(batches.flat())),
    });
    mockCursorServer(batches);

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'indeterminate', reason: 'probe-cap' });
    expect(mockGetImages).toHaveBeenCalledTimes(20);
    expect(store.has('imageList:all:fr')).toBe(false);
  });

  it('Task 1b: a played-out terminal batch maps to indeterminate (never exhausted → no cycle reset, no played-set wipe)', async () => {
    const b1 = batch('old-', 5);
    const store = mockStore({
      'lastImageUuid:all:fr': b1[4].pictureId,
      'playedPictureIds:public:fr': JSON.stringify(pictureIds(batch('played-', 5))),
    });
    mockGetImages.mockImplementation(async () => ({ isError: false, reason: 'played-out', images: [] }));

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS });

    expect(result).toEqual({ status: 'indeterminate', reason: 'played-out' });
    expect(mockGetImages).toHaveBeenCalledTimes(1);
    expect(store.get('lastImageUuid:all:fr')).toBe(b1[4].pictureId);
    expect(store.has('imageList:all:fr')).toBe(false);
  });

  it('Task 6d: private scope played-out maps to indeterminate too (no startNewServingCycle, played set kept)', async () => {
    const scope = { kind: 'private', groupId: 'g-1' };
    const playedGroup = batch('gplayed-', 5);
    const store = mockStore({
      'groupFeed:g-1:game:all:fr:cursor': 'g-cursor-5',
      'playedPictureIds:group:g-1:fr': JSON.stringify(pictureIds(playedGroup)),
    });
    mockGetImages.mockImplementation(async () => ({ isError: false, reason: 'played-out', images: [] }));

    const result = await probeAllPoolForUnplayed({ language: 'fr', scope, authContext: { token: 't' } });

    expect(result).toEqual({ status: 'indeterminate', reason: 'played-out' });
    expect(mockGetImages).toHaveBeenCalledTimes(1);
    expect(store.get('playedPictureIds:group:g-1:fr')).toBe(JSON.stringify(pictureIds(playedGroup)));
    expect(
      mockAsyncStorage.setItem.mock.calls.filter(([key]) => key.startsWith('servingCycle:')),
    ).toHaveLength(0);
    expect(writeGroupFeedCache).not.toHaveBeenCalled();
  });

  it('excludePictureId is excluded from the unplayed check (probe keeps draining past it)', async () => {
    const justPlayed = { pictureId: 'just-played', imageFile: 'file:///cache/just.jpg' };
    const store = mockStore({
      'playedPictureIds:public:fr': JSON.stringify(['other-played']),
    });
    const b1 = batch('old-', 5);
    store.set('lastImageUuid:all:fr', b1[4].pictureId);
    mockCursorServer([b1, [justPlayed, { pictureId: 'other-played', imageFile: 'file:///cache/other.jpg' }]]);

    const result = await probeAllPoolForUnplayed({ ...PUBLIC_ARGS, excludePictureId: 'just-played' });

    expect(result).toEqual({ status: 'exhausted' });
    expect(store.has('imageList:all:fr')).toBe(false);
  });

  it('private scope: group "all" namespace deck write + group-scoped cursor, no public bleed', async () => {
    const scope = { kind: 'private', groupId: 'g-1' };
    const b2 = batch('gplayed-', 2);
    const b3 = batch('gfresh-', 3);
    const store = mockStore({
      'playedPictureIds:group:g-1:fr': JSON.stringify(pictureIds(b2)),
    });
    const b1 = batch('gold-', 5);
    store.set('groupFeed:g-1:game:all:fr:cursor', b1[4].pictureId);
    mockCursorServer([b1, b2, b3]);

    const result = await probeAllPoolForUnplayed({ language: 'fr', scope, authContext: { token: 't' } });

    expect(result).toEqual({ status: 'unplayed' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-1',
      { categoryId: undefined, language: 'fr' },
      {
        images: b3.map((card, i) => ({ ...card, listId: i + 1 })),
        nextCursor: null,
      },
    );
    expect(store.get('groupFeed:g-1:game:all:fr:cursor')).toBe(b3[2].pictureId);
    expect(store.has('lastImageUuid:all:fr')).toBe(false);
    expect(store.has('imageList:all:fr')).toBe(false);
  });
});
