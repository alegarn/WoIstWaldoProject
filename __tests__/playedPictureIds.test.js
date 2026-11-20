jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addPlayedPictureId,
  filterPlayedCards,
  getPlayedPictureIds,
  playedPictureIdsKey,
  resetPlayedPictureIdsForScope,
} from '../utils/playedPictureIds';
import { _debugLocksSize } from '../utils/scopeMutex';

describe('playedPictureIds (Fix 2 module extraction)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getAllKeys.mockResolvedValue([]);
    AsyncStorage.multiRemove.mockResolvedValue(undefined);
  });

  it('(a) add/get roundtrip under scope-segmented keys with group isolation', async () => {
    expect(playedPictureIdsKey('fr', { kind: 'public' })).toBe('playedPictureIds:public:fr');
    expect(playedPictureIdsKey(undefined, null)).toBe('playedPictureIds:public:any');
    expect(playedPictureIdsKey('fr', { kind: 'private', groupId: 'gA' })).toBe('playedPictureIds:group:gA:fr');

    await addPlayedPictureId('pic-1', 'fr', { kind: 'public' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('playedPictureIds:public:fr', JSON.stringify(['pic-1']));

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['pic-1']));
    expect(await getPlayedPictureIds('fr', { kind: 'public' })).toEqual(['pic-1']);

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await getPlayedPictureIds('fr', { kind: 'private', groupId: 'gB' })).toEqual([]);
    expect(AsyncStorage.getItem).toHaveBeenLastCalledWith('playedPictureIds:group:gB:fr');
  });

  it('(b) caps the set at 200 and evicts the oldest id on overflow', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(
      Array.from({ length: 200 }, (_, i) => `p-${i}`),
    ));

    await addPlayedPictureId('new-one', 'fr', null);

    const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(written).toHaveLength(200);
    expect(written[0]).toBe('p-1');
    expect(written[written.length - 1]).toBe('new-one');
  });

  it('(b2) idempotent add does not rewrite the set (no cap churn)', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['pic-1']));

    await addPlayedPictureId('pic-1', 'fr', null);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('(e) falsy pictureId is a no-op (no write)', async () => {
    await addPlayedPictureId(undefined, 'fr', null);
    await addPlayedPictureId(null, 'fr', null);
    await addPlayedPictureId('', 'fr', null);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('(e2) concurrent adds for the same scope serialize so both ids persist', async () => {
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
    let store = JSON.stringify([]);
    let releaseFirstWrite;
    const firstWriteGate = new Promise((resolve) => {
      releaseFirstWrite = resolve;
    });
    let firstWriteGated = false;

    AsyncStorage.getItem.mockImplementation(async (key) => (key === 'playedPictureIds:public:fr' ? store : null));
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      if (key !== 'playedPictureIds:public:fr') {
        return;
      }
      if (!firstWriteGated) {
        firstWriteGated = true;
        await firstWriteGate;
      }
      store = value;
    });

    const first = addPlayedPictureId('pic-1', 'fr', null);
    await flushMicrotasks();
    await flushMicrotasks();

    const second = addPlayedPictureId('pic-2', 'fr', null);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(AsyncStorage.getItem.mock.calls.filter(([key]) => key === 'playedPictureIds:public:fr')).toHaveLength(1);

    releaseFirstWrite();
    await first;
    await second;

    expect(JSON.parse(store)).toEqual(['pic-1', 'pic-2']);
  });

  it('(c2) cross-key lock isolation: concurrent adds in different scopes do not serialize; no locks linger', async () => {
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
    const stores = new Map([
      ['playedPictureIds:public:fr', JSON.stringify([])],
      ['playedPictureIds:group:gA:fr', JSON.stringify([])],
    ]);
    let releasePublicWrite;
    const publicWriteGate = new Promise((resolve) => { releasePublicWrite = resolve; });

    AsyncStorage.getItem.mockImplementation(async (key) => stores.get(key) ?? null);
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      if (key === 'playedPictureIds:public:fr') {
        await publicWriteGate;
      }
      stores.set(key, value);
    });

    const publicAdd = addPlayedPictureId('pub-1', 'fr', null);
    await flushMicrotasks();
    await flushMicrotasks();

    const groupAdd = addPlayedPictureId('grp-1', 'fr', { kind: 'private', groupId: 'gA' });
    await flushMicrotasks();
    await flushMicrotasks();

    // Distinct played-set lock keys → the group RMW must NOT queue behind
    // the gated public write: its read-modify-write already completed.
    const groupWrites = AsyncStorage.setItem.mock.calls.filter(([key]) => key === 'playedPictureIds:group:gA:fr');
    expect(groupWrites).toHaveLength(1);

    releasePublicWrite();
    await publicAdd;
    await groupAdd;
    await flushMicrotasks();

    expect(JSON.parse(stores.get('playedPictureIds:public:fr'))).toEqual(['pub-1']);
    expect(JSON.parse(stores.get('playedPictureIds:group:gA:fr'))).toEqual(['grp-1']);
    expect(_debugLocksSize()).toBe(0);
  });

  it('(i) filterPlayedCards passes pictureId-less cards through', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['a']));

    const filtered = await filterPlayedCards([
      { pictureId: 'a' },
      { listId: 5 },
      { pictureId: 'b' },
    ], 'fr', null);

    expect(filtered).toEqual([{ listId: 5 }, { pictureId: 'b' }]);
  });

  describe('resetPlayedPictureIdsForScope (Fix 1 replay-cycle restart)', () => {
    it('reset clears the exact public key for the language', async () => {
      const store = new Map([['playedPictureIds:public:fr', JSON.stringify(['pic-1'])]]);
      AsyncStorage.getItem.mockImplementation(async (key) => store.get(key) ?? null);
      AsyncStorage.removeItem.mockImplementation(async (key) => { store.delete(key); });

      await resetPlayedPictureIdsForScope('fr', null);

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
      expect(store.has('playedPictureIds:public:fr')).toBe(false);
    });

    it('reset clears the exact group key and leaves the public key untouched (no bleed)', async () => {
      const store = new Map([
        ['playedPictureIds:group:gA:fr', JSON.stringify(['grp-1'])],
        ['playedPictureIds:public:fr', JSON.stringify(['pub-1'])],
      ]);
      AsyncStorage.getItem.mockImplementation(async (key) => store.get(key) ?? null);
      AsyncStorage.removeItem.mockImplementation(async (key) => { store.delete(key); });

      await resetPlayedPictureIdsForScope('fr', { kind: 'private', groupId: 'gA' });

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:group:gA:fr');
      expect(store.has('playedPictureIds:group:gA:fr')).toBe(false);
      expect(JSON.parse(store.get('playedPictureIds:public:fr'))).toEqual(['pub-1']);
    });

    it('reset is a no-op (no throw) when the key is missing', async () => {
      AsyncStorage.getItem.mockImplementation(async () => null);

      await expect(resetPlayedPictureIdsForScope('fr', null)).resolves.toBeUndefined();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
    });

    it('RACE (add write gated): concurrent reset queues on the same lock key, then wipes the settled id', async () => {
      const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
      let store = null;
      let releaseAddWrite;
      const addWriteGate = new Promise((resolve) => { releaseAddWrite = resolve; });
      let addWriteGated = false;

      AsyncStorage.getItem.mockImplementation(async () => store);
      AsyncStorage.setItem.mockImplementation(async (key, value) => {
        if (!addWriteGated) {
          addWriteGated = true;
          await addWriteGate;
        }
        store = value;
      });
      AsyncStorage.removeItem.mockImplementation(async () => { store = null; });

      const add = addPlayedPictureId('pic-1', 'fr', null);
      await flushMicrotasks();
      await flushMicrotasks();

      const reset = resetPlayedPictureIdsForScope('fr', null);
      await flushMicrotasks();
      await flushMicrotasks();

      // The reset shares the add's lock key → its removeItem must wait for
      // the in-flight write (without the shared lock it would fire now and
      // the gated add write would resurrect the id afterwards).
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

      releaseAddWrite();
      await add;
      await reset;
      await flushMicrotasks();

      // Deterministic lock-serialized outcome for this interleaving: the add
      // settles first, then the reset removes the exact key → key absent.
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('playedPictureIds:public:fr');
      expect(store).toBeNull();
      expect(_debugLocksSize()).toBe(0);
    });

    it('RACE (reset gated): concurrent add queues on the same lock key, then re-lands only its own id', async () => {
      const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
      let store = JSON.stringify(['stale-1']);
      let releaseResetWrite;
      const resetWriteGate = new Promise((resolve) => { releaseResetWrite = resolve; });
      let resetWriteGated = false;

      AsyncStorage.getItem.mockImplementation(async () => store);
      AsyncStorage.removeItem.mockImplementation(async () => {
        if (!resetWriteGated) {
          resetWriteGated = true;
          await resetWriteGate;
        }
        store = null;
      });
      AsyncStorage.setItem.mockImplementation(async (key, value) => { store = value; });

      const reset = resetPlayedPictureIdsForScope('fr', null);
      await flushMicrotasks();
      await flushMicrotasks();

      const add = addPlayedPictureId('pic-1', 'fr', null);
      await flushMicrotasks();
      await flushMicrotasks();

      // The add shares the reset's lock key → its read-modify-write must
      // wait (no stale read racing the pending removal).
      expect(AsyncStorage.getItem.mock.calls.filter(([key]) => key === 'playedPictureIds:public:fr')).toHaveLength(0);

      releaseResetWrite();
      await reset;
      await add;
      await flushMicrotasks();

      // Deterministic lock-serialized outcome for this interleaving: the
      // reset settles first, then the serialized add re-reads post-reset and
      // re-lands exactly its own id (the stale id is gone).
      expect(JSON.parse(store)).toEqual(['pic-1']);
      expect(_debugLocksSize()).toBe(0);
    });
  });
});
