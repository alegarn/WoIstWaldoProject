// Behavior-driven suite: the prefetcher runs against the REAL cardDeck,
// storageDatum, playedPictureIds and groupFeedCache modules. Only the true
// boundaries are faked: the getImages transport seam, AsyncStorage (stateful
// in-memory store), expo-file-system, and the E2E environment flag.
// Outcomes are asserted through deck contents in AsyncStorage and the calls
// the transport received — never through internal collaborator pins.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true })
);

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;
    delete = jest.fn();
    constructor(base?: string | { uri?: string }, child?: string) {
      const baseUri = typeof base === 'string' ? base : base?.uri;
      if (baseUri === undefined) {
        throw new Error('MockFile: missing uri');
      }
      this.uri = child ? `${baseUri}${child}` : baseUri;
    }
  }
  return {
    __esModule: true,
    File: MockFile,
    Paths: {
      get cache() {
        return { uri: 'file:///cache/' };
      },
    },
  };
});

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImages } from '../utils/imagesRequests';
import { saveLastImageUuid } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import { prefetchIfLow, warmAllDeckIfNeeded, __resetForTests } from '../services/cardPrefetcher';

const transport = getImages as unknown as jest.Mock;
const e2eMock = isE2EMode as unknown as jest.Mock;

// ─── Fake feed transport ────────────────────────────────────────────────────
// Serves cursor-paged batches per feed key (the feed key mirrors what
// fetchCardBatch/buildFeedFilters put on the wire) and persists each served
// batch's tail through the REAL saveLastImageUuid, exactly like the production
// transport. A chain entry is one of:
//   - a card batch (served when the cursor reaches it; empty array = terminal
//     genuine-empty batch)
//   - a full error/played-out response object
//   - an Error (transport crash)
//   - { deferred, cards } — a card batch gated behind a promise, so a test can
//     park the transport mid-flight.

type FakeCard = { pictureId: string; imageFile: string };
type FakeErrorResponse =
  | { isError: true; reason?: 'network' | 'server' }
  | { isError: false; reason: 'played-out'; images: [] };
type ChainEntry = FakeCard[] | FakeErrorResponse | Error | { deferred: Promise<void>; cards: FakeCard[] };

const feedChains = new Map<string, ChainEntry[]>();

function card(pictureId: string): FakeCard {
  return { pictureId, imageFile: `file:///cache/${pictureId}.jpg` };
}

function cardBatch(prefix: string, count: number, startAt = 1): FakeCard[] {
  return Array.from({ length: count }, (_, i) => card(`${prefix}${i + startAt}`));
}

function feedKeyOf(filters: {
  category_key?: string;
  category_id?: string;
  scope?: { kind?: string; groupId?: string } | null;
} | null): string {
  const scope = filters?.scope;
  if (scope && typeof scope === 'object' && scope.kind === 'private' && scope.groupId) {
    return `private:${scope.groupId}:${filters?.category_id ?? 'all'}`;
  }
  return filters?.category_key ?? '__all__';
}

function cursorCategoryOf(filters: {
  category_key?: string;
  category_id?: string;
  scope?: { kind?: string } | null;
} | null): string {
  const scope = filters?.scope;
  if (scope && typeof scope === 'object' && scope.kind === 'private') {
    return filters?.category_key ?? filters?.category_id ?? 'all';
  }
  return filters?.category_key ?? 'all';
}

async function serveFeed(
  pictureId: string | null,
  _context: unknown,
  filters: Parameters<typeof feedKeyOf>[0],
  ...rest: unknown[]
) {
  const opts = rest[0] as { persistCursor?: boolean } | undefined;
  const batches = feedChains.get(feedKeyOf(filters)) ?? [];
  const index = pictureId === null
    ? 0
    : batches.findIndex((b) => Array.isArray(b) && b.length > 0 && b[b.length - 1]!.pictureId === pictureId) + 1;
  const entry = batches[index];
  if (!entry) {
    return { isError: false, reason: 'empty', images: [] };
  }
  if (entry instanceof Error) {
    throw entry;
  }
  if (!Array.isArray(entry) && !('deferred' in entry)) {
    return entry;
  }
  const cards = Array.isArray(entry) ? entry : await entry.deferred.then(() => entry.cards);
  if (cards.length === 0) {
    return { isError: false, reason: 'empty', images: [] };
  }
  if (opts?.persistCursor !== false) {
    await saveLastImageUuid(cards[cards.length - 1]!.pictureId, cursorCategoryOf(filters), filters?.language, filters?.scope);
  }
  return { isError: false, images: cards };
}

function chain(feedKey: string, entries: ChainEntry[]): void {
  feedChains.set(feedKey, entries);
}

type TransportCall = { pictureId: string | null; filters: Record<string, unknown> };

function transportCalls(): TransportCall[] {
  return transport.mock.calls.map(([pictureId, _context, filters]) => ({
    pictureId: pictureId as string | null,
    filters: (filters ?? {}) as Record<string, unknown>,
  }));
}

function callsFor(feedKey: string): TransportCall[] {
  const privatePrefix = `private:`;
  return transportCalls().filter((call) => {
    const key = feedKeyOf(call.filters as Parameters<typeof feedKeyOf>[0]);
    if (feedKey.startsWith(privatePrefix)) {
      return key === feedKey;
    }
    return key === feedKey;
  });
}

// ─── Storage helpers ────────────────────────────────────────────────────────

const ALL_DECK_KEY = 'imageList:all:fr';
const CITY_DECK_KEY = 'imageList:city:fr';
const CITY_EXHAUSTED_KEY = 'exhaustedCategory:city:fr';

async function storedDeck(key: string): Promise<Array<{ pictureId?: string; listId?: number }> | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function seedDeck(key: string, cards: FakeCard[]): Promise<void> {
  const numbered = cards.map((c, i) => ({ ...c, listId: i + 1 }));
  await AsyncStorage.setItem(key, JSON.stringify(numbered));
}

async function resetStore(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  if (keys.length > 0) {
    await AsyncStorage.multiRemove(keys);
  }
}

// Fails deck writes for one storage key so the failure surfaces inside the
// prefetcher's own catch (reported + deck unchanged) without rejecting the
// transport promise itself — a rejecting transport leaves fetchCardBatch's
// fire-and-forget `p.finally(...)` bookkeeping promise unhandled, which kills
// the Node test process. Returns a restore function.
function failDeckWrites(deckKey: string): () => void {
  const stateful = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    (key: string, value: string) => (key === deckKey ? Promise.reject(new Error('disk full')) : stateful(key, value))
  );
  return () => (AsyncStorage.setItem as jest.Mock).mockImplementation(stateful);
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

const PUBLIC_ARGS = { language: 'fr', scope: { kind: 'public' }, authContext: {} };
const prefetchCity = { ...PUBLIC_ARGS, categoryKey: 'city', categoryId: 7 } as const;
const prefetchAll = { ...PUBLIC_ARGS, categoryKey: 'all' } as const;
const warmArgs = PUBLIC_ARGS;

describe('cardPrefetcher (behavior-driven)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    feedChains.clear();
    transport.mockReset();
    transport.mockImplementation(serveFeed as never);
    __resetForTests();
    e2eMock.mockReturnValue(false);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('prefetchIfLow — when a deck runs low', () => {
    it('prefetches when only three cards remain ahead of the cursor and grows the persisted deck', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 3));
      chain('__all__', [cardBatch('n', 2)]);

      await prefetchIfLow(prefetchAll);

      expect(callsFor('__all__')).toHaveLength(1);
      const deck = await storedDeck(ALL_DECK_KEY);
      expect(deck).toHaveLength(5);
      expect(deck!.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'c3', 'n1', 'n2']);
    });

    it('does not prefetch while four cards remain ahead of the cursor', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 4));

      await prefetchIfLow(prefetchAll);

      expect(transport).not.toHaveBeenCalled();
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(4);
    });

    it('pages forward from the stored cursor instead of restarting at the feed head', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 2));
      await AsyncStorage.setItem('lastImageUuid:all:fr', 'c2');
      chain('__all__', [cardBatch('c', 2), cardBatch('n', 2)]);

      await prefetchIfLow(prefetchAll);

      const calls = callsFor('__all__');
      expect(calls).toHaveLength(1);
      expect(calls[0]!.pictureId).toBe('c2');
      expect((await storedDeck(ALL_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'n1', 'n2']);
    });

    it('a cold deck pages from the feed head', async () => {
      chain('__all__', [cardBatch('c', 2)]);

      await prefetchIfLow(prefetchAll);

      expect(callsFor('__all__')[0]!.pictureId).toBeNull();
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
    });

    it('a failed batch (isError) leaves the deck unchanged and marks nothing', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 2));
      chain('__all__', [{ isError: true }]);

      await prefetchIfLow(prefetchAll);

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
      const keys = await AsyncStorage.getAllKeys();
      expect(keys.filter((k) => k.startsWith('exhaustedCategory:'))).toEqual([]);
    });

    it('a failure mid-prefetch is swallowed, reported, and leaves the deck unchanged', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 2));
      chain('__all__', [cardBatch('n', 2)]);
      const restore = failDeckWrites(ALL_DECK_KEY);

      try {
        await expect(prefetchIfLow(prefetchAll)).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith('[cardPrefetcher] prefetch failed', expect.any(String), expect.any(Error));
        expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
      } finally {
        restore();
      }
    });
  });

  describe('prefetchIfLow — dedup', () => {
    it('concurrent prefetches for the same deck share one round-trip', async () => {
      chain('__all__', [cardBatch('c', 2)]);

      await Promise.all([prefetchIfLow(prefetchAll), prefetchIfLow(prefetchAll)]);

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
    });

    it('a settled prefetch does not block the next one', async () => {
      chain('__all__', [cardBatch('c', 2), cardBatch('n', 2)]);

      await prefetchIfLow(prefetchAll);
      await prefetchIfLow(prefetchAll);

      expect(callsFor('__all__')).toHaveLength(2);
      expect((await storedDeck(ALL_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'n1', 'n2']);
    });
  });

  describe('prefetchIfLow — deck-level top-up from "all"', () => {
    it('a category top-up below the deck target pulls the remainder from the all deck', async () => {
      chain('city', [cardBatch('k', 3)]);
      chain('__all__', [cardBatch('a', 2)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('city')).toHaveLength(1);
      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(CITY_DECK_KEY)).toHaveLength(3);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
    });

    it('a category top-up that reaches the deck target leaves the all deck alone', async () => {
      chain('city', [cardBatch('k', 5)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('city')).toHaveLength(1);
      expect(callsFor('__all__')).toHaveLength(0);
      expect(await storedDeck(CITY_DECK_KEY)).toHaveLength(5);
    });

    it('a category marked exhausted skips its round-trip and fills the deck from "all"', async () => {
      await AsyncStorage.setItem(CITY_EXHAUSTED_KEY, '1');
      chain('__all__', [cardBatch('a', 5)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('city')).toHaveLength(0);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('an empty category batch marks the category exhausted', async () => {
      chain('city', [[]]);
      chain('__all__', [cardBatch('a', 1)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBe('1');
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(1);
    });

    it('a 5xx-style failure does not mark the category exhausted', async () => {
      chain('city', [{ isError: true }]);
      chain('__all__', [cardBatch('a', 1)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBeNull();
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(1);
    });

    it('"all" never writes an exhausted marker, even when the server has nothing', async () => {
      chain('__all__', [[]]);

      await prefetchIfLow(prefetchAll);

      expect(callsFor('__all__')).toHaveLength(1);
      const keys = await AsyncStorage.getAllKeys();
      expect(keys.filter((k) => k.startsWith('exhaustedCategory:'))).toEqual([]);
      expect(await storedDeck(ALL_DECK_KEY)).toBeNull();
    });

    it('the top-up size follows how much the category landing actually added', async () => {
      await seedDeck(CITY_DECK_KEY, cardBatch('c', 2));
      chain('city', [cardBatch('k', 2)]);
      chain('__all__', [cardBatch('a', 1)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('__all__')).toHaveLength(1);

      await resetStore();
      transport.mockClear();
      feedChains.clear();
      await seedDeck(CITY_DECK_KEY, cardBatch('c', 2));
      chain('city', [cardBatch('k', 4)]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('__all__')).toHaveLength(0);
    });

    it('a category down to its last cards hands off to the all deck in the same cycle', async () => {
      await seedDeck(CITY_DECK_KEY, cardBatch('c', 3));
      chain('city', [[card('k4')]]);
      chain('__all__', [[card('a1')]]);

      await prefetchIfLow(prefetchCity);
      await settle();

      expect(callsFor('city')).toHaveLength(1);
      expect(callsFor('__all__')).toHaveLength(1);
      expect((await storedDeck(CITY_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'c3', 'k4']);
      expect((await storedDeck(ALL_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['a1']);
    });
  });

  describe('warmAllDeckIfNeeded', () => {
    it('fills the all deck to target once; an immediate repeat short-circuits', async () => {
      chain('__all__', [cardBatch('a', 5)]);

      await warmAllDeckIfNeeded(warmArgs);
      await warmAllDeckIfNeeded(warmArgs);

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('a partial all deck is topped up to target, not skipped', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 2));
      await AsyncStorage.setItem('lastImageUuid:all:fr', 'c2');
      chain('__all__', [cardBatch('c', 2), cardBatch('n', 3)]);

      await warmAllDeckIfNeeded(warmArgs);

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('a deck exhausted for the cursor still warms (cursor-aware count)', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 5));
      chain('__all__', [cardBatch('n', 6)]);

      await warmAllDeckIfNeeded({ ...warmArgs, currentListId: 42 });

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(11);
    });

    it('a deck with enough cards ahead of the cursor does not warm', async () => {
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 5));

      await warmAllDeckIfNeeded(warmArgs);

      expect(transport).not.toHaveBeenCalled();
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('a failed warm is retried on the next call', async () => {
      chain('__all__', [cardBatch('a', 5), cardBatch('d', 5)]);
      const restore = failDeckWrites(ALL_DECK_KEY);

      try {
        await warmAllDeckIfNeeded(warmArgs);
      } finally {
        restore();
      }
      await warmAllDeckIfNeeded(warmArgs);

      expect(callsFor('__all__')).toHaveLength(2);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('a warm failure is reported even when __DEV__ is false', async () => {
      const priorDev = global.__DEV__;
      global.__DEV__ = false;
      chain('__all__', [cardBatch('a', 5)]);
      const restore = failDeckWrites(ALL_DECK_KEY);

      try {
        await warmAllDeckIfNeeded(warmArgs);

        expect(warnSpy).toHaveBeenCalledWith('[cardPrefetcher] warm-all failed', expect.any(String), expect.any(Error));
      } finally {
        restore();
        global.__DEV__ = priorDev;
      }
    });

    it('concurrent warms share one round-trip', async () => {
      chain('__all__', [cardBatch('a', 5)]);

      await Promise.all([warmAllDeckIfNeeded(warmArgs), warmAllDeckIfNeeded(warmArgs)]);

      expect(callsFor('__all__')).toHaveLength(1);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });

    it('a drained all deck is warmed again on the next warm', async () => {
      chain('__all__', [cardBatch('a', 5), cardBatch('d', 5)]);

      await warmAllDeckIfNeeded(warmArgs);
      await AsyncStorage.setItem(ALL_DECK_KEY, '[]');
      await warmAllDeckIfNeeded(warmArgs);

      expect(callsFor('__all__')).toHaveLength(2);
      expect((await storedDeck(ALL_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
    });

    it('an empty warm result appends nothing and is retried on the next warm', async () => {
      chain('__all__', [[]]);

      await warmAllDeckIfNeeded(warmArgs);
      expect(await storedDeck(ALL_DECK_KEY)).toBeNull();

      feedChains.set('__all__', [cardBatch('a', 5)]);
      await warmAllDeckIfNeeded(warmArgs);

      expect(callsFor('__all__')).toHaveLength(2);
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    });
  });

  describe('persistence contracts', () => {
    it('server cards without listIds are persisted with fresh, unique listIds', async () => {
      chain('__all__', [
        [
          { pictureId: 'raw-1', imageFile: 'file:///cache/raw-1.jpg' },
          { pictureId: 'raw-2', imageFile: 'file:///cache/raw-2.jpg' },
        ],
      ]);

      await prefetchIfLow(prefetchAll);

      const deck = await storedDeck(ALL_DECK_KEY);
      expect(deck!.map((c) => c.listId)).toEqual([1, 2]);
    });

    it('prefetch and warm are no-ops in e2e mode', async () => {
      e2eMock.mockReturnValue(true);
      await seedDeck(ALL_DECK_KEY, cardBatch('c', 2));

      await prefetchIfLow(prefetchCity);
      await warmAllDeckIfNeeded(warmArgs);

      expect(transport).not.toHaveBeenCalled();
      expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(2);
    });
  });
});
