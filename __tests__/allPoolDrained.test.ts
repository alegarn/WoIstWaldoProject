// Behavior tests for utils/allPoolDrained — the epoch-stamped 'all' pool
// drained marker (D3). The stamp key is
// `allPoolDrained:<public|group:<gid>>:<lang>:drained`: the trailing constant
// `drained` segment keeps the language a MIDDLE segment so servingCycle's
// belt-clear matcher (`key.includes(':<lang>:')`) hits it without adjustment.
// Value = the serving-cycle epoch the stamp was written for; freshness is
// `stored === current epoch`. Fresh fixtures are built through the REAL
// re-stamp path (startNewServingCycle → markAllPoolDrained(returnedEpoch)),
// never by hand-writing a stamp with a made-up epoch.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true })
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAllPoolDrained,
  getAllPoolDrainedEpoch,
  isAllPoolDrainedFresh,
  markAllPoolDrained,
} from '../utils/allPoolDrained';
import { getServingCycleEpoch, startNewServingCycle } from '../utils/servingCycle';

const PUBLIC_SCOPE = { kind: 'public' };
const GROUP_SCOPE = { kind: 'private', groupId: 'g-1' };

async function drainedKeyCount(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith('allPoolDrained:')).length;
}

describe('allPoolDrained (epoch-stamped drained marker)', () => {
  describe('key shape', () => {
    it('public scope stamps `allPoolDrained:public:<lang>:drained` with the epoch as value', async () => {
      await markAllPoolDrained('fr', PUBLIC_SCOPE, 1);

      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBe('1');
      expect(await getAllPoolDrainedEpoch('fr', PUBLIC_SCOPE)).toBe(1);
    });

    it('group scope stamps `allPoolDrained:group:<gid>:<lang>:drained`', async () => {
      await markAllPoolDrained('fr', GROUP_SCOPE, 2);

      expect(await AsyncStorage.getItem('allPoolDrained:group:g-1:fr:drained')).toBe('2');
      expect(await getAllPoolDrainedEpoch('fr', GROUP_SCOPE)).toBe(2);
      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBeNull();
    });

    it('a missing language lands in the `any` namespace, trailing :drained tail intact', async () => {
      await markAllPoolDrained(null, PUBLIC_SCOPE, 3);

      expect(await AsyncStorage.getItem('allPoolDrained:public:any:drained')).toBe('3');
      expect(await getAllPoolDrainedEpoch(null, PUBLIC_SCOPE)).toBe(3);
    });
  });

  describe('freshness', () => {
    it('a stamp written with the epoch a REAL restart returned is fresh (the 4b re-stamp path)', async () => {
      const newEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, newEpoch);

      expect(newEpoch).toBe(1);
      expect(await getAllPoolDrainedEpoch('fr', PUBLIC_SCOPE)).toBe(newEpoch);
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(true);
    });

    it('a restart without re-stamp belt-clears the stamp; a stale orphan (older epoch) is never fresh', async () => {
      const firstEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, firstEpoch);

      await startNewServingCycle('fr', PUBLIC_SCOPE);

      expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(firstEpoch + 1);
      expect(await getAllPoolDrainedEpoch('fr', PUBLIC_SCOPE)).toBeNull();
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(false);

      await markAllPoolDrained('fr', PUBLIC_SCOPE, firstEpoch);
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(false);
    });

    it('no stamp is never fresh, even at epoch 0', async () => {
      expect(await getServingCycleEpoch('fr', PUBLIC_SCOPE)).toBe(0);
      expect(await getAllPoolDrainedEpoch('fr', PUBLIC_SCOPE)).toBeNull();
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(false);
    });

    it('stamps are scope- and language-isolated', async () => {
      const newEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, newEpoch);

      expect(await getAllPoolDrainedEpoch('fr', GROUP_SCOPE)).toBeNull();
      expect(await isAllPoolDrainedFresh('fr', GROUP_SCOPE)).toBe(false);
      expect(await getAllPoolDrainedEpoch('en', PUBLIC_SCOPE)).toBeNull();
      expect(await isAllPoolDrainedFresh('en', PUBLIC_SCOPE)).toBe(false);
    });
  });

  describe('clear', () => {
    it('clearAllPoolDrained removes the stamp so it stops being fresh', async () => {
      const newEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, newEpoch);
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(true);

      await clearAllPoolDrained('fr', PUBLIC_SCOPE);

      expect(await getAllPoolDrainedEpoch('fr', PUBLIC_SCOPE)).toBeNull();
      expect(await isAllPoolDrainedFresh('fr', PUBLIC_SCOPE)).toBe(false);
    });
  });

  describe('cycle-restart belt-clear (servingCycle integration)', () => {
    it('a public restart ACTUALLY deletes the same-scope stamp key (count 1 → 0)', async () => {
      const firstEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, firstEpoch);
      expect(await drainedKeyCount()).toBe(1);

      await startNewServingCycle('fr', PUBLIC_SCOPE);

      expect(await drainedKeyCount()).toBe(0);
      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBeNull();
    });

    it('a group restart ACTUALLY deletes that group\'s stamp key (count 1 → 0)', async () => {
      await markAllPoolDrained('fr', GROUP_SCOPE, 2);
      expect(await drainedKeyCount()).toBe(1);

      await startNewServingCycle('fr', GROUP_SCOPE);

      expect(await drainedKeyCount()).toBe(0);
      expect(await AsyncStorage.getItem('allPoolDrained:group:g-1:fr:drained')).toBeNull();
    });

    it('a public restart does NOT delete a group-scope stamp (cross-scope non-deletion)', async () => {
      await markAllPoolDrained('fr', GROUP_SCOPE, 2);
      expect(await AsyncStorage.getItem('allPoolDrained:group:g-1:fr:drained')).toBe('2');

      await startNewServingCycle('fr', PUBLIC_SCOPE);

      expect(await AsyncStorage.getItem('allPoolDrained:group:g-1:fr:drained')).toBe('2');
      expect(await drainedKeyCount()).toBe(1);
    });

    it('a group restart does NOT delete a public-scope stamp (cross-scope non-deletion)', async () => {
      await markAllPoolDrained('fr', PUBLIC_SCOPE, 2);
      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBe('2');

      await startNewServingCycle('fr', GROUP_SCOPE);

      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBe('2');
      expect(await drainedKeyCount()).toBe(1);
    });

    it('a restart for another language keeps this language\'s stamp', async () => {
      const firstEpoch = await startNewServingCycle('fr', PUBLIC_SCOPE);
      await markAllPoolDrained('fr', PUBLIC_SCOPE, firstEpoch);

      await startNewServingCycle('en', PUBLIC_SCOPE);

      expect(await AsyncStorage.getItem('allPoolDrained:public:fr:drained')).toBe(String(firstEpoch));
      expect(await drainedKeyCount()).toBe(1);
    });
  });
});
