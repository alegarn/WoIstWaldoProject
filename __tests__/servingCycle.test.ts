jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SERVING_CYCLE_PREFIX,
  getServingCycleEpoch,
  isCycleExhausted,
  resetServingCycles,
  servingCycleKey,
  startNewServingCycle,
} from '../utils/servingCycle';
import { addPlayedPictureId } from '../utils/playedPictureIds';
import { _debugLocksSize } from '../utils/scopeMutex';

// jest.mock factory above is untyped; cast to a typed mock view so
// .mockImplementation / .mockResolvedValue are visible to TypeScript
// (same pattern as __tests__/nextCardAdvancer.test.ts).
const mockAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.MockedFunction<(key: string) => Promise<string | null>>;
  setItem: jest.MockedFunction<(key: string, value: string) => Promise<void>>;
  removeItem: jest.MockedFunction<(key: string) => Promise<void>>;
  getAllKeys: jest.MockedFunction<() => Promise<readonly string[]>>;
  multiRemove: jest.MockedFunction<(keys: readonly string[]) => Promise<void>>;
};

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

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('servingCycle (card-serving-cycle Task A1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
  });

  it('epoch defaults to 0 for a fresh scope', async () => {
    mockStore();

    expect(await getServingCycleEpoch('fr', null)).toBe(0);
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('servingCycle:public:fr');
  });

  it('startNewServingCycle increments and persists the epoch', async () => {
    const store = mockStore();

    expect(await startNewServingCycle('fr', null)).toBe(1);
    expect(store.get('servingCycle:public:fr')).toBe('1');
    expect(await getServingCycleEpoch('fr', null)).toBe(1);

    expect(await startNewServingCycle('fr', null)).toBe(2);
    expect(await getServingCycleEpoch('fr', null)).toBe(2);
  });

  it('epoch keys are isolated public vs group and per language', async () => {
    expect(servingCycleKey('fr', null)).toBe('servingCycle:public:fr');
    expect(servingCycleKey(undefined, undefined)).toBe('servingCycle:public:any');
    expect(servingCycleKey('fr', { kind: 'private', groupId: 'gA' })).toBe('servingCycle:group:gA:fr');
    expect(servingCycleKey('en', null)).not.toBe(servingCycleKey('fr', null));

    const store = mockStore({ 'servingCycle:public:fr': '3' });

    expect(await getServingCycleEpoch('fr', null)).toBe(3);
    expect(await getServingCycleEpoch('en', null)).toBe(0);
    expect(await getServingCycleEpoch('fr', { kind: 'private', groupId: 'gA' })).toBe(0);
    expect(store.get('servingCycle:public:fr')).toBe('3');
  });

  it('startNewServingCycle clears the scope+language played-set', async () => {
    const store = mockStore({ 'playedPictureIds:public:fr': JSON.stringify(['pic-1', 'pic-2']) });

    await startNewServingCycle('fr', null);

    expect(store.has('servingCycle:public:fr')).toBe(true);
    expect(store.has('playedPictureIds:public:fr')).toBe(false);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
  });

  it('startNewServingCycle clears only the target scope\'s played-set (no cross-group/public bleed)', async () => {
    const store = mockStore({
      'playedPictureIds:group:gA:fr': JSON.stringify(['grp-a']),
      'playedPictureIds:group:gB:fr': JSON.stringify(['grp-b']),
      'playedPictureIds:public:fr': JSON.stringify(['pub']),
    });

    await startNewServingCycle('fr', { kind: 'private', groupId: 'gA' });

    expect(store.has('playedPictureIds:group:gA:fr')).toBe(false);
    expect(JSON.parse(store.get('playedPictureIds:group:gB:fr') ?? '[]')).toEqual(['grp-b']);
    expect(JSON.parse(store.get('playedPictureIds:public:fr') ?? '[]')).toEqual(['pub']);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:group:gA:fr');
  });

  it('concurrent startNewServingCycle serialize — epoch increments exactly twice, played-set absent', async () => {
    const store = mockStore({ 'playedPictureIds:public:fr': JSON.stringify(['pic-1']) });

    const first = startNewServingCycle('fr', null);
    const second = startNewServingCycle('fr', null);
    const epochs = [await first, await second];

    expect(epochs.sort()).toEqual([1, 2]);
    expect(await getServingCycleEpoch('fr', null)).toBe(2);
    expect(store.get('servingCycle:public:fr')).toBe('2');
    expect(store.has('playedPictureIds:public:fr')).toBe(false);
    await flushMicrotasks();
    expect(_debugLocksSize()).toBe(0);
  });

  it('resetServingCycles removes all servingCycle keys incl. group keys', async () => {
    const store = mockStore({
      'servingCycle:public:fr': '1',
      'servingCycle:public:en': '4',
      'servingCycle:group:gA:fr': '2',
      'playedPictureIds:public:fr': JSON.stringify(['pic-1']),
    });

    await resetServingCycles();

    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      'servingCycle:public:fr',
      'servingCycle:public:en',
      'servingCycle:group:gA:fr',
    ]);
    expect(Array.from(store.keys()).every((key) => !key.startsWith(`${SERVING_CYCLE_PREFIX}:`))).toBe(true);
    expect(store.has('playedPictureIds:public:fr')).toBe(true);
  });

  it('isCycleExhausted true only when server served >0 and servable === 0 (pure, table-driven)', () => {
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();

    const cases: Array<[serverBatchCount: number, servableCount: number, expected: boolean]> = [
      [5, 0, true],
      [1, 0, true],
      [0, 0, false],
      [0, 3, false],
      [5, 3, false],
      [5, 1, false],
    ];

    cases.forEach(([serverBatchCount, servableCount, expected]) => {
      expect(isCycleExhausted(serverBatchCount, servableCount)).toBe(expected);
    });
  });

  it('startNewServingCycle removes lastImageUuid cursors (every category key + \'all\') for the scope+language', async () => {
    const store = mockStore({
      'lastImageUuid:interiors:fr:any': 'uuid-1',
      'lastImageUuid:nature:fr:any': 'uuid-2',
      'lastImageUuid:all:fr:any': '__public_feed_end__',
      'lastImageUuid:interiors:en:any': 'uuid-en',
    });

    await startNewServingCycle('fr', null);

    expect(store.has('lastImageUuid:interiors:fr:any')).toBe(false);
    expect(store.has('lastImageUuid:nature:fr:any')).toBe(false);
    expect(store.has('lastImageUuid:all:fr:any')).toBe(false);
    expect(store.get('lastImageUuid:interiors:en:any')).toBe('uuid-en');
  });

  it('startNewServingCycle removes exhaustedCategory markers including \'all\'', async () => {
    const store = mockStore({
      'exhaustedCategory:interiors:fr:any': '1',
      'exhaustedCategory:all:fr:any': '1',
      'exhaustedCategory:interiors:en:any': '1',
    });

    await startNewServingCycle('fr', null);

    expect(store.has('exhaustedCategory:interiors:fr:any')).toBe(false);
    expect(store.has('exhaustedCategory:all:fr:any')).toBe(false);
    expect(store.get('exhaustedCategory:interiors:en:any')).toBe('1');
  });

  it('group scope clears group :cursor + groupFeedExhausted, leaves public cursors alone', async () => {
    const store = mockStore({
      'groupFeed:gA:cat-uuid-1:fr:any:cursor': JSON.stringify({ nextCursor: 'cursor-1' }),
      'groupFeed:gA:all:fr:any:cursor': JSON.stringify({ nextCursor: null }),
      'groupFeed:gA:cat-uuid-1:fr:any': JSON.stringify([{ listId: 1 }]),
      'groupFeed:gA:game:cat-uuid-1:fr:any:cursor': 'cursor-game-1',
      'groupFeed:gA:game:all:fr:any:cursor': '__private_feed_end__',
      'groupFeedExhausted:gA:cat-uuid-1:fr:any': '1',
      'groupFeed:gB:cat-uuid-1:fr:any:cursor': JSON.stringify({ nextCursor: 'cursor-b' }),
      'groupFeedExhausted:gB:cat-uuid-1:fr:any': '1',
      'lastImageUuid:interiors:fr:any': 'public-cursor',
      'exhaustedCategory:interiors:fr:any': '1',
      'groupFeed:gA:cat-uuid-1:en:any:cursor': JSON.stringify({ nextCursor: 'cursor-en' }),
    });

    await startNewServingCycle('fr', { kind: 'private', groupId: 'gA' });

    expect(store.has('groupFeed:gA:cat-uuid-1:fr:any:cursor')).toBe(false);
    expect(store.has('groupFeed:gA:all:fr:any:cursor')).toBe(false);
    // F1/F2 junction pin: the group-scoped GAME transport cursor keys match
    // the clear pattern (groupFeed:<gid>:*:<lang>:cursor) so the transition
    // wipes the live private cursor — no post-transition cursor-mode misses.
    expect(store.has('groupFeed:gA:game:cat-uuid-1:fr:any:cursor')).toBe(false);
    expect(store.has('groupFeed:gA:game:all:fr:any:cursor')).toBe(false);
    expect(store.has('groupFeedExhausted:gA:cat-uuid-1:fr:any')).toBe(false);
    expect(JSON.parse(store.get('groupFeed:gA:cat-uuid-1:fr:any') ?? '[]')).toEqual([{ listId: 1 }]);
    expect(store.get('lastImageUuid:interiors:fr:any')).toBe('public-cursor');
    expect(store.get('exhaustedCategory:interiors:fr:any')).toBe('1');
    expect(store.get('groupFeed:gB:cat-uuid-1:fr:any:cursor')).toBe(JSON.stringify({ nextCursor: 'cursor-b' }));
    expect(store.get('groupFeedExhausted:gB:cat-uuid-1:fr:any')).toBe('1');
    expect(store.get('groupFeed:gA:cat-uuid-1:en:any:cursor')).toBe(JSON.stringify({ nextCursor: 'cursor-en' }));
  });

  it('public scope leaves group keys untouched (no bleed)', async () => {
    const store = mockStore({
      'lastImageUuid:interiors:fr:any': 'public-cursor',
      'lastImageUuid:all:fr:any': '__public_feed_end__',
      'groupFeed:gA:cat-uuid-1:fr:any:cursor': JSON.stringify({ nextCursor: 'cursor-1' }),
      'groupFeed:gA:cat-uuid-1:fr:any': JSON.stringify([{ listId: 1 }]),
      'groupFeed:gA:game:cat-uuid-1:fr:any:cursor': 'cursor-game-1',
      'groupFeedExhausted:gA:cat-uuid-1:fr:any': '1',
    });

    await startNewServingCycle('fr', null);

    expect(store.has('lastImageUuid:interiors:fr:any')).toBe(false);
    expect(store.has('lastImageUuid:all:fr:any')).toBe(false);
    // F1/F2: a public transition must never wipe the group-scoped private
    // game cursor (pre-fix the private cursor lived at lastImageUuid:<uuid>
    // and was over-broadly cleared by the public branch).
    expect(store.get('groupFeed:gA:cat-uuid-1:fr:any:cursor')).toBe(JSON.stringify({ nextCursor: 'cursor-1' }));
    expect(store.get('groupFeed:gA:game:cat-uuid-1:fr:any:cursor')).toBe('cursor-game-1');
    expect(JSON.parse(store.get('groupFeed:gA:cat-uuid-1:fr:any') ?? '[]')).toEqual([{ listId: 1 }]);
    expect(store.get('groupFeedExhausted:gA:cat-uuid-1:fr:any')).toBe('1');
  });

  it('locks released after each call (_debugLocksSize() === 0)', async () => {
    mockStore();

    await getServingCycleEpoch('fr', null);
    expect(_debugLocksSize()).toBe(0);

    await startNewServingCycle('fr', null);
    expect(_debugLocksSize()).toBe(0);

    await startNewServingCycle('fr', { kind: 'private', groupId: 'gA' });
    expect(_debugLocksSize()).toBe(0);

    await addPlayedPictureId('pic-1', 'fr', null);
    await startNewServingCycle('fr', null);
    expect(_debugLocksSize()).toBe(0);
  });
});

describe('Task C7: cycle reset is mode-agnostic (contains-match on the language segment)', () => {
  it('public transition clears mode-segmented cursors + markers for EVERY mode, keeps other languages and the epoch key', async () => {
    const store = mockStore({
      'servingCycle:public:fr': '0',
      'lastImageUuid:city:fr:point': 'u1',
      'lastImageUuid:city:fr:shape': 'u2',
      'lastImageUuid:all:fr:any': '__public_feed_end__',
      'exhaustedCategory:city:fr:shape': '1',
      'exhaustedCategory:all:fr:point': '1',
      'lastImageUuid:city:en:point': 'kept-en',
      'exhaustedCategory:city:en:any': 'kept-en',
      'groupFeed:gA:game:cat:fr:shape:cursor': 'kept-group',
    });

    await startNewServingCycle('fr', null);

    expect(store.has('lastImageUuid:city:fr:point')).toBe(false);
    expect(store.has('lastImageUuid:city:fr:shape')).toBe(false);
    expect(store.has('lastImageUuid:all:fr:any')).toBe(false);
    expect(store.has('exhaustedCategory:city:fr:shape')).toBe(false);
    expect(store.has('exhaustedCategory:all:fr:point')).toBe(false);
    expect(store.get('lastImageUuid:city:en:point')).toBe('kept-en');
    expect(store.get('exhaustedCategory:city:en:any')).toBe('kept-en');
    expect(store.get('groupFeed:gA:game:cat:fr:shape:cursor')).toBe('kept-group');
    expect(store.get('servingCycle:public:fr')).toBe('1');
  });

  it('group transition clears mode-segmented group cursors + exhausted markers for EVERY mode, keeps deck lists and other groups', async () => {
    const store = mockStore({
      'groupFeed:gA:cat:fr:point:cursor': JSON.stringify({ nextCursor: 'c1' }),
      'groupFeed:gA:game:cat:fr:any:cursor': 'c2',
      'groupFeed:gA:game:all:fr:shape:cursor': '__private_feed_end__',
      'groupFeedExhausted:gA:cat:fr:shape': '1',
      'groupFeedExhausted:gA:all:fr:point': '1',
      'groupFeed:gA:cat:fr:any': JSON.stringify([{ listId: 1 }]),
      'groupFeed:gB:cat:fr:point:cursor': 'kept-b',
      'groupFeedExhausted:gB:cat:fr:point': 'kept-b',
      'lastImageUuid:city:fr:point': 'kept-public',
    });

    await startNewServingCycle('fr', { kind: 'private', groupId: 'gA' });

    expect(store.has('groupFeed:gA:cat:fr:point:cursor')).toBe(false);
    expect(store.has('groupFeed:gA:game:cat:fr:any:cursor')).toBe(false);
    expect(store.has('groupFeed:gA:game:all:fr:shape:cursor')).toBe(false);
    expect(store.has('groupFeedExhausted:gA:cat:fr:shape')).toBe(false);
    expect(store.has('groupFeedExhausted:gA:all:fr:point')).toBe(false);
    expect(store.get('groupFeed:gA:cat:fr:any')).toBe(JSON.stringify([{ listId: 1 }]));
    expect(store.get('groupFeed:gB:cat:fr:point:cursor')).toBe('kept-b');
    expect(store.get('groupFeedExhausted:gB:cat:fr:point')).toBe('kept-b');
    expect(store.get('lastImageUuid:city:fr:point')).toBe('kept-public');
  });
});
