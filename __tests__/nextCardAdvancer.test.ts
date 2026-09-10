// Behavior-driven suite: the advancer runs against the REAL handleGuessOutcome
// resolver, cardDeck, storageDatum, servingCycle and cardPrefetcher modules.
// Only the true boundaries are faked: the getImages transport seam, AsyncStorage
// (stateful in-memory store), expo-file-system, and the E2E environment flag.
// Outcomes are asserted through the card the player gets served, deck contents
// and markers in AsyncStorage, and the requests the transport received — never
// through internal collaborator pins.

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
import { prefetchIfLow, __resetForTests } from '../services/cardPrefetcher';
import { probeAllPoolForUnplayed } from '../services/cardDeck';
import { getServingCycleEpoch } from '../utils/servingCycle';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';

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
// headReplayQueues optionally scripts responses for head-replay calls
// (persistCursor:false) beyond the first — used to pin the bounded-retry
// behavior when the replayed head must differ between attempts.

type FakeCard = { pictureId: string; imageFile: string };
type FakeErrorResponse =
  | { isError: true; reason?: 'network' | 'server' }
  | { isError: false; reason: 'played-out'; images: [] };
type ChainEntry = FakeCard[] | FakeErrorResponse;

const feedChains = new Map<string, ChainEntry[]>();
const headReplayQueues = new Map<string, ChainEntry[]>();

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
  const feedKey = feedKeyOf(filters);
  if (opts?.persistCursor === false) {
    const queued = headReplayQueues.get(feedKey);
    if (queued && queued.length > 0) {
      const entry = queued.shift()!;
      return Array.isArray(entry) && entry.length === 0
        ? { isError: false, reason: 'empty', images: [] }
        : Array.isArray(entry)
          ? { isError: false, images: entry }
          : entry;
    }
  }
  const batches = feedChains.get(feedKey) ?? [];
  const index = pictureId === null
    ? 0
    : batches.findIndex((b) => Array.isArray(b) && b.length > 0 && b[b.length - 1]!.pictureId === pictureId) + 1;
  const entry = batches[index];
  if (!entry) {
    return { isError: false, reason: 'empty', images: [] };
  }
  if (!Array.isArray(entry)) {
    return entry;
  }
  if (entry.length === 0) {
    return { isError: false, reason: 'empty', images: [] };
  }
  if (opts?.persistCursor !== false) {
    await saveLastImageUuid(entry[entry.length - 1]!.pictureId, cursorCategoryOf(filters), filters?.language, filters?.scope);
  }
  return { isError: false, images: entry };
}

function chain(feedKey: string, entries: ChainEntry[]): void {
  feedChains.set(feedKey, entries);
}

function scriptHeadReplays(feedKey: string, entries: ChainEntry[]): void {
  headReplayQueues.set(feedKey, entries);
}

type TransportCall = { pictureId: string | null; filters: Record<string, unknown>; headReplay: boolean };

function transportCalls(): TransportCall[] {
  return transport.mock.calls.map(([pictureId, _context, filters, opts]) => ({
    pictureId: pictureId as string | null,
    filters: (filters ?? {}) as Record<string, unknown>,
    headReplay: (opts as { persistCursor?: boolean } | undefined)?.persistCursor === false,
  }));
}

function callsFor(feedKey: string): TransportCall[] {
  return transportCalls().filter((call) => feedKeyOf(call.filters as Parameters<typeof feedKeyOf>[0]) === feedKey);
}

function headReplaysFor(feedKey: string): TransportCall[] {
  return callsFor(feedKey).filter((call) => call.headReplay);
}

// ─── Storage helpers ────────────────────────────────────────────────────────

const ALL_DECK_KEY = 'imageList:all:fr';
const CITY_DECK_KEY = 'imageList:city:fr';
const CITY_EXHAUSTED_KEY = 'exhaustedCategory:city:fr';
const PUBLIC_SCOPE = { kind: 'public' };
const GROUP_SCOPE = { kind: 'private', groupId: 'g-1' };

async function storedDeck(key: string): Promise<Array<{ pictureId?: string; listId?: number }> | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function seedDeck(key: string, cards: FakeCard[]): Promise<void> {
  const numbered = cards.map((c, i) => ({ ...c, listId: i + 1 }));
  await AsyncStorage.setItem(key, JSON.stringify(numbered));
}

async function seedGroupDeck(groupId: string, categoryId: string, cards: FakeCard[]): Promise<void> {
  const numbered = cards.map((c, i) => ({ ...c, listId: i + 1 }));
  await AsyncStorage.setItem(`groupFeed:${groupId}:${categoryId}:fr`, JSON.stringify(numbered));
}

async function seedPlayedPublic(pictureIds: string[]): Promise<void> {
  await AsyncStorage.setItem('playedPictureIds:public:fr', JSON.stringify(pictureIds));
}

async function seedPlayedGroup(groupId: string, pictureIds: string[]): Promise<void> {
  await AsyncStorage.setItem(`playedPictureIds:group:${groupId}:fr`, JSON.stringify(pictureIds));
}

async function exhaustedMarkerKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith('exhaustedCategory:'));
}

const PUBLIC_ARGS = { language: 'fr', scope: PUBLIC_SCOPE, authContext: { token: 'x' } };
const cityArgs = { ...PUBLIC_ARGS, category: { id: 7, key: 'city' }, currentListId: 3, isTutorial: false };
const allArgs = { ...PUBLIC_ARGS, category: { key: 'all' }, currentListId: 3, isTutorial: false };

describe('resolveNextCardWithServerFallback (behavior-driven)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    feedChains.clear();
    headReplayQueues.clear();
    transport.mockReset();
    transport.mockImplementation(serveFeed as never);
    __resetForTests();
    e2eMock.mockReturnValue(false);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('serves the next card from the local deck without contacting the server', async () => {
    await seedDeck(CITY_DECK_KEY, cardBatch('c', 9));

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('c4');
    expect(transport).not.toHaveBeenCalled();
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
  });

  it('foreground-fetches the drained category and serves the fetched card', async () => {
    await seedDeck(CITY_DECK_KEY, cardBatch('c', 3));
    await AsyncStorage.setItem('lastImageUuid:city:fr', 'c3');
    chain('city', [cardBatch('c', 3), cardBatch('k', 2)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('k1');
    const calls = callsFor('city');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.pictureId).toBe('c3');
    expect(calls[0]!.filters.category_key).toBe('city');
    expect(calls[0]!.filters.language).toBe('fr');
    expect(calls[0]!.filters.category_id).toBeUndefined();
    expect((await storedDeck(CITY_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'c3', 'k1', 'k2']);
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
  });

  it('records the category exhausted when the server has no more category cards, then serves from the warmed all deck', async () => {
    chain('city', [[]]);
    chain('__all__', [cardBatch('a', 5)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBe('1');
    expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(5);
    expect(callsFor('city')).toHaveLength(1);
    expect(callsFor('__all__')).toHaveLength(1);
    expect(callsFor('__all__')[0]!.filters.language).toBe('fr');
  });

  it('warms the all deck even when it looks full overall but is drained ahead of the cursor', async () => {
    await seedDeck(ALL_DECK_KEY, cardBatch('a', 5));
    await seedPlayedPublic(['a1', 'a2', 'a3', 'a4', 'a5']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'a5');
    chain('__all__', [cardBatch('a', 5), cardBatch('n', 2)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('n1');
    const calls = callsFor('__all__');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.pictureId).toBe('a5');
    expect(await storedDeck(ALL_DECK_KEY)).toHaveLength(7);
  });

  it('shares one category round-trip when a background prefetch and an advance race on the same scope', async () => {
    await seedDeck(CITY_DECK_KEY, cardBatch('c', 10));
    await AsyncStorage.setItem('lastImageUuid:city:fr', 'c10');
    chain('city', [cardBatch('c', 10), cardBatch('k', 2)]);
    chain('__all__', [[]]);

    const prefetchPromise = prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: PUBLIC_SCOPE,
      authContext: { token: 'x' },
      currentListId: 10,
    });
    const advancePromise = resolveNextCardWithServerFallback({ ...cityArgs, currentListId: 10 });
    const [advanceResult] = await Promise.all([advancePromise, prefetchPromise]);

    expect(callsFor('city')).toHaveLength(1);
    expect((advanceResult.next as { params: { pictureId: string } }).params.pictureId).toBe('k1');
    const deck = (await storedDeck(CITY_DECK_KEY))!;
    expect(deck.map((c) => c.pictureId)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'k1', 'k2']);
    const pictureIds = deck.map((c) => c.pictureId);
    expect(new Set(pictureIds).size).toBe(pictureIds.length);
  });

  it('replays fresh cards by re-fetching the all pool from the head when the cursor is drained', async () => {
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'r2');
    chain('__all__', [cardBatch('r', 2), []]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('r1');
    const calls = callsFor('__all__');
    expect(calls).toHaveLength(3);
    const headReplay = headReplaysFor('__all__');
    expect(headReplay).toHaveLength(1);
    expect(headReplay[0]!.pictureId).toBeNull();
    expect(headReplay[0]!.filters.category_key).toBeUndefined();
    expect((await storedDeck(ALL_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['r1', 'r2']);
  });

  it('after a proven pool exhaustion starts a new cycle and replays the already-played deck cards with no extra fetch', async () => {
    await seedDeck(ALL_DECK_KEY, cardBatch('a', 5));
    await seedPlayedPublic(['a1', 'a2', 'a3', 'a4', 'a5']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'a5');
    chain('__all__', [cardBatch('a', 5), []]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(1);
    expect(callsFor('__all__')).toHaveLength(3);
  });

  it('bounces with reason "empty" only after the head re-fetch also finds nothing', async () => {
    chain('__all__', [[]]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('empty');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
    expect(await exhaustedMarkerKeys()).toEqual([]);
    expect(callsFor('__all__')).toHaveLength(2);
  });

  it('recovers through the warmed all deck when the category fetch fails', async () => {
    await seedDeck(CITY_DECK_KEY, cardBatch('c', 3));
    await AsyncStorage.setItem('lastImageUuid:city:fr', 'c3');
    chain('city', [{ isError: true, reason: 'network' }]);
    chain('__all__', [cardBatch('a', 5)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(callsFor('city')).toHaveLength(1);
    expect(callsFor('__all__')).toHaveLength(1);
    expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBeNull();
  });

  it('looping replay targets the all pool without leaking the original category or its id', async () => {
    await seedPlayedPublic(['r1', 'r2', 'r3']);
    chain('sports', [[]]);
    chain('__all__', [cardBatch('r', 3), []]);
    const sportsArgs = { ...PUBLIC_ARGS, category: { id: 5, key: 'sports' }, currentListId: 3, isTutorial: false };

    const result = await resolveNextCardWithServerFallback(sportsArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('r1');
    const allCalls = callsFor('__all__');
    const headReplays = headReplaysFor('__all__');
    expect(headReplays.length).toBeGreaterThanOrEqual(1);
    for (const call of headReplays) {
      expect(call.pictureId).toBeNull();
      expect(call.filters.category_key).toBeUndefined();
      expect(call.filters.category_id).toBeUndefined();
    }
    expect(callsFor('sports').every((c) => c.filters.category_key === 'sports')).toBe(true);
  });

  it('never re-serves the just-played card when the server re-sends it', async () => {
    await seedDeck(CITY_DECK_KEY, [card('played-card')]);
    chain('city', [[card('played-card'), card('new-card')]]);

    const result = await resolveNextCardWithServerFallback({ ...cityArgs, currentListId: 1 });

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('new-card');
    const deck = (await storedDeck(CITY_DECK_KEY))!;
    expect(deck.map((c) => c.pictureId)).toEqual(['played-card', 'new-card']);
    expect(deck[0]!.listId).toBe(1);
  });

  it('a non-empty batch landing for the category lifts a stale exhausted marker', async () => {
    const { persistCardBatch } = require('../services/cardDeck');
    await AsyncStorage.setItem(CITY_EXHAUSTED_KEY, '1');

    await persistCardBatch({ cards: cardBatch('k', 2), categoryKey: 'city', language: 'fr' });

    expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBeNull();
    expect((await storedDeck(CITY_DECK_KEY))!.map((c) => c.pictureId)).toEqual(['k1', 'k2']);
  });

  it('a category known exhausted skips its fetch and still falls back to the all deck', async () => {
    await AsyncStorage.setItem(CITY_EXHAUSTED_KEY, '1');
    chain('city', [cardBatch('k', 2)]);
    chain('__all__', [cardBatch('a', 5)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(callsFor('city')).toHaveLength(0);
    expect(callsFor('__all__')).toHaveLength(1);
  });

  it('a played-out category batch is not recorded as exhausted, unlike a genuine empty one', async () => {
    chain('city', [{ isError: false, reason: 'played-out', images: [] }]);
    chain('__all__', [cardBatch('a', 5)]);

    const playedOutResult = await resolveNextCardWithServerFallback(cityArgs);

    expect(playedOutResult.reason).toBe('ok');
    expect((playedOutResult.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBeNull();

    await AsyncStorage.multiRemove(await AsyncStorage.getAllKeys());
    feedChains.clear();
    chain('city', [[]]);
    chain('__all__', [cardBatch('b', 5)]);

    const genuineEmptyResult = await resolveNextCardWithServerFallback(cityArgs);

    expect(await AsyncStorage.getItem(CITY_EXHAUSTED_KEY)).toBe('1');
    expect((genuineEmptyResult.next as { params: { pictureId: string } }).params.pictureId).toBe('b1');
  });

  it('a played-out private category batch is not recorded as exhausted, unlike a genuine empty one', async () => {
    const privateArgs = {
      ...PUBLIC_ARGS,
      category: { id: 'cat-private-uuid', key: 'cat-private-uuid' },
      currentListId: 3,
      isTutorial: false,
      scope: GROUP_SCOPE,
    };
    const markerKey = 'groupFeedExhausted:g-1:cat-private-uuid:fr';
    chain('private:g-1:cat-private-uuid', [{ isError: false, reason: 'played-out', images: [] }]);
    chain('private:g-1:all', [cardBatch('a', 2)]);

    const playedOutResult = await resolveNextCardWithServerFallback(privateArgs);

    expect(playedOutResult.reason).toBe('ok');
    expect(await AsyncStorage.getItem(markerKey)).toBeNull();

    await AsyncStorage.multiRemove(await AsyncStorage.getAllKeys());
    feedChains.clear();
    chain('private:g-1:cat-private-uuid', [[]]);
    chain('private:g-1:all', [cardBatch('a', 2)]);

    const genuineEmptyResult = await resolveNextCardWithServerFallback(privateArgs);

    expect(await AsyncStorage.getItem(markerKey)).toBe('1');
    expect((genuineEmptyResult.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
  });

  it('a failed category fetch never poisons the exhausted marker and the all deck still serves', async () => {
    chain('city', [{ isError: true }]);
    chain('__all__', [cardBatch('a', 1)]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await exhaustedMarkerKeys()).toEqual([]);
  });

  it('network failure on every fetch surfaces reason "network" and writes no marker', async () => {
    chain('city', [{ isError: true, reason: 'network' }]);
    chain('__all__', [{ isError: true, reason: 'network' }]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('network');
    expect(callsFor('city')).toHaveLength(1);
    expect(callsFor('__all__')).toHaveLength(2);
    expect(await exhaustedMarkerKeys()).toEqual([]);
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
  });

  it('server failure on every fetch surfaces reason "server"', async () => {
    chain('city', [{ isError: true }]);
    chain('__all__', [{ isError: true }]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('server');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
  });

  it('empty beats network when tier failures are mixed', async () => {
    chain('city', [{ isError: true, reason: 'network' }]);
    chain('__all__', [[]]);

    const result = await resolveNextCardWithServerFallback(cityArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('empty');
  });

  it('exhausting a category for one group does not exhaust it for another', async () => {
    const { markCategoryExhausted, isCategoryExhausted } = require('../utils/storageDatum');

    await markCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' });

    expect(await isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(true);
    expect(await isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupB' })).toBe(false);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain('groupFeedExhausted:groupA:city:fr');
    expect(keys).not.toContain('groupFeedExhausted:groupB:city:fr');
  });

  it('purging private caches drops the group exhausted marker', async () => {
    const { markCategoryExhausted, isCategoryExhausted } = require('../utils/storageDatum');
    const { purgeAllPrivateCaches } = require('../services/groups/groupFeedCache');

    await markCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' });
    expect(await isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(true);

    await purgeAllPrivateCaches();

    expect(await isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(false);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).not.toContain('groupFeedExhausted:groupA:city:fr');
  });

  it('a proven exhaustion retries the all head exactly once and replays the cycled deck', async () => {
    await seedPlayedPublic(['a1', 'a2']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'a2');
    chain('__all__', [cardBatch('a', 2), []]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(1);
    expect(callsFor('__all__')).toHaveLength(4);
  });

  it('the replay resolve drops a stale cursor that can never be satisfied', async () => {
    await seedDeck(ALL_DECK_KEY, cardBatch('r', 2));
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'r2');
    chain('__all__', [cardBatch('r', 2), []]);

    const result = await resolveNextCardWithServerFallback({ ...allArgs, currentListId: 999 });

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('r1');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(1);
    expect(callsFor('__all__')).toHaveLength(3);
  });

  it('a failed replay retry stops after one attempt with a single cycle transition', async () => {
    await seedPlayedPublic(['p1', 'p2']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'stale-cursor');
    chain('__all__', [[]]);
    scriptHeadReplays('__all__', [cardBatch('p', 2)]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('empty');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(1);
    expect(callsFor('__all__')).toHaveLength(4);
  });

  it('a group-scope exhaustion transitions the group cycle and replays its deck', async () => {
    await seedPlayedGroup('g-1', ['a1', 'a2']);
    await AsyncStorage.setItem('groupFeed:g-1:game:all:fr:cursor', 'a2');
    chain('private:g-1:all', [cardBatch('a', 2), []]);
    const groupArgs = { ...PUBLIC_ARGS, category: { key: 'all' }, currentListId: 3, isTutorial: false, scope: GROUP_SCOPE };

    const result = await resolveNextCardWithServerFallback(groupArgs);

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('a1');
    expect(await getServingCycleEpoch('fr', GROUP_SCOPE)).toBe(1);
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
    expect(callsFor('private:g-1:all')).toHaveLength(4);
  });

  it('when the probe finds unplayed cards beyond the head batch, they serve without a cycle transition', async () => {
    await seedPlayedPublic(['p1', 'p2']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'stale-cursor');
    chain('__all__', [cardBatch('p', 2), cardBatch('u', 2)]);

    const result = await resolveNextCardWithServerFallback({ ...allArgs, currentListId: 0 });

    expect(result.reason).toBe('ok');
    expect((result.next as { params: { pictureId: string } }).params.pictureId).toBe('u1');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
    expect(callsFor('__all__')).toHaveLength(3);
  });

  it('an indeterminate probe never transitions the cycle', async () => {
    await seedPlayedPublic(['p1', 'p2']);
    await AsyncStorage.setItem('lastImageUuid:all:fr', 'p2');
    chain('__all__', [cardBatch('p', 2), [{ isError: false, reason: 'played-out', images: [] }] as unknown as FakeCard[]]);

    const result = await resolveNextCardWithServerFallback(allArgs);

    expect(result.next).toBeNull();
    expect(result.reason).toBe('empty');
    expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
    expect(callsFor('__all__')).toHaveLength(3);
  });

  it('a failing cycle transition is swallowed and the advance still completes with a typed result', async () => {
    const statefulSetItem = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
    let rejectedOnce = false;
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      if (key.startsWith('servingCycle') && !rejectedOnce) {
        rejectedOnce = true;
        return Promise.reject(new Error('disk full'));
      }
      return statefulSetItem(key, value);
    });

    try {
      await seedPlayedPublic(['a1', 'a2']);
      await AsyncStorage.setItem('lastImageUuid:all:fr', 'a2');
      chain('__all__', [cardBatch('a', 2), []]);

      const result = await resolveNextCardWithServerFallback(allArgs);

      expect(result.next).toBeNull();
      expect(result.reason).toBe('empty');
      expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
      expect(callsFor('__all__')).toHaveLength(4);
    } finally {
      (AsyncStorage.setItem as jest.Mock).mockImplementation(statefulSetItem);
    }
  });

  it('the pool probe does not count the just-won card as unplayed proof', async () => {
    chain('__all__', [[card('just-won')], []]);

    const excluded = await probeAllPoolForUnplayed({
      language: 'fr',
      scope: PUBLIC_SCOPE,
      authContext: { token: 'x' },
      excludePictureId: 'just-won',
    });
    expect(excluded).toEqual({ status: 'exhausted' });

    await AsyncStorage.multiRemove(await AsyncStorage.getAllKeys());
    feedChains.set('__all__', [[card('just-won')], []]);

    const counting = await probeAllPoolForUnplayed({
      language: 'fr',
      scope: PUBLIC_SCOPE,
      authContext: { token: 'x' },
    });
    expect(counting).toEqual({ status: 'unplayed' });
  });
});
