jest.mock('@react-native-async-storage/async-storage', () =>
  require('./helpers/statefulAsyncStorageMock')({ autoReset: true })
);

jest.mock('expo-file-system', () => {
  const deletedFiles = [];
  const cacheFiles = new Set();

  class MockFile {
    constructor(base, child) {
      this.uri = typeof base === 'string' ? base : `${base?.uri ?? ''}${child ?? ''}`;
      this.exists = true;
      this.delete = jest.fn(() => {
        deletedFiles.push(this.uri);
      });
    }
  }

  const cacheDir = {
    uri: 'file:///cache/',
    list: jest.fn(() => Array.from(cacheFiles)),
  };

  return {
    __esModule: true,
    File: MockFile,
    Paths: {
      get cache() {
        return cacheDir;
      },
    },
    __deletedFiles: deletedFiles,
    __cacheFiles: cacheFiles,
    __cacheList: cacheDir.list,
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __deletedFiles as deletedFiles,
  __cacheFiles as cacheFiles,
  __cacheList as cacheList,
} from 'expo-file-system';

import { applySuccessSideEffects } from '../utils/handleGuessOutcome';
import { getPending } from '../utils/sessionScoreStore';
import { getPlayedPictureIds } from '../utils/playedPictureIds';

const DECK_KEY = 'imageList:animals:en';
const PLAYED_PUBLIC_KEY = 'playedPictureIds:public:en';
const PLAYED_GROUP_KEY = 'playedPictureIds:group:g-3:en';

const baseArgs = {
  listId: 1,
  categoryKey: 'animals',
  language: 'en',
  imageFile: 'file:///img.png',
  pictureId: 'pic-1',
  scope: { kind: 'public' },
  userId: 'user-1',
};

function seedDeck() {
  return AsyncStorage.setItem(DECK_KEY, JSON.stringify([
    { listId: 1, pictureId: 'pic-1', imageFile: 'file:///img.png' },
    { listId: 2, pictureId: 'pic-2', imageFile: 'file:///cache/pic-2.jpg' },
  ]));
}

async function storedDeck() {
  return JSON.parse(await AsyncStorage.getItem(DECK_KEY));
}

describe('applySuccessSideEffects', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    cacheFiles.clear();
    deletedFiles.length = 0;
    cacheList.mockClear();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  async function bufferedScores() {
    return getPending();
  }

  it('a plain win buffers a single score event with defaults: 1 point, streak 0, no multipliers', async () => {
    await applySuccessSideEffects(baseArgs);

    const scores = await bufferedScores();
    expect(scores).toHaveLength(1);
    expect(scores[0]).toEqual(expect.objectContaining({
      points: 1,
      streak: 0,
      pictureId: 'pic-1',
      userId: 'user-1',
      scope: { kind: 'public' },
      ts: expect.any(Number),
      guessId: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/),
    }));
    expect('multiplier' in scores[0]).toBe(false);
    expect('streakMultiplier' in scores[0]).toBe(false);
  });

  it('a streaked, multiplied win buffers those bonuses on the score event', async () => {
    await applySuccessSideEffects({ ...baseArgs, points: 2, multiplier: 2, streak: 5, streakMultiplier: 1.5 });

    const scores = await bufferedScores();
    expect(scores).toHaveLength(1);
    expect(scores[0]).toEqual(expect.objectContaining({
      points: 2,
      multiplier: 2,
      streak: 5,
      streakMultiplier: 1.5,
      pictureId: 'pic-1',
      userId: 'user-1',
    }));
  });

  it('a win with streak but no streak multiplier omits the streak multiplier', async () => {
    await applySuccessSideEffects({ ...baseArgs, streak: 5 });

    const [score] = await bufferedScores();
    expect(score).toEqual(expect.objectContaining({ streak: 5 }));
    expect('streakMultiplier' in score).toBe(false);
  });

  it('a failed deck cleanup keeps the buffered score and stops the remaining cleanup', async () => {
    await seedDeck();
    const baseGetItem = AsyncStorage.getItem.getMockImplementation();
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === DECK_KEY) {
        throw new Error('deck read boom');
      }
      return baseGetItem(key);
    });

    try {
      await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();
    } finally {
      AsyncStorage.getItem.mockImplementation(baseGetItem);
    }

    expect(await bufferedScores()).toHaveLength(1);
    expect(await storedDeck()).toHaveLength(2);
    expect(deletedFiles).toEqual([]);
    expect(cacheList).not.toHaveBeenCalled();
  });

  it('a failed played-set write stays silent and the rest of the win still applies', async () => {
    await seedDeck();
    const baseSetItem = AsyncStorage.setItem.getMockImplementation();
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      if (String(key).startsWith('playedPictureIds')) {
        throw new Error('played write failed');
      }
      return baseSetItem(key, value);
    });

    try {
      await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();
    } finally {
      AsyncStorage.setItem.mockImplementation(baseSetItem);
    }

    expect(await getPlayedPictureIds('en', baseArgs.scope)).toEqual([]);
    expect(await bufferedScores()).toHaveLength(1);
    expect(await storedDeck()).toEqual([expect.objectContaining({ pictureId: 'pic-2' })]);
    expect(deletedFiles).toEqual(expect.arrayContaining(['file:///img.png']));
  });

  it('a public win records the played picture, drops the card from its deck, deletes the winner file, and sweeps orphaned cache files', async () => {
    await seedDeck();
    cacheFiles.add('file:///cache/pic-1.jpg');
    cacheFiles.add('file:///cache/pic-2.jpg');
    cacheFiles.add('file:///cache/private-x.jpg');
    cacheFiles.add('file:///cache/other.jpg');

    await applySuccessSideEffects(baseArgs);

    expect(await getPlayedPictureIds('en', baseArgs.scope)).toEqual(['pic-1']);
    expect(await storedDeck()).toEqual([expect.objectContaining({ pictureId: 'pic-2' })]);
    expect(deletedFiles).toEqual(expect.arrayContaining(['file:///img.png', 'file:///cache/pic-1.jpg']));
    expect(deletedFiles).not.toEqual(expect.arrayContaining([
      expect.stringContaining('pic-2.jpg'),
      expect.stringContaining('private-x.jpg'),
      expect.stringContaining('other.jpg'),
    ]));
  });

  it('a private-group win records the picture group-scoped and skips the public orphan sweep', async () => {
    await seedDeck();

    await applySuccessSideEffects({ ...baseArgs, scope: { kind: 'private', groupId: 'g-3' } });

    expect(await getPlayedPictureIds('en', { kind: 'private', groupId: 'g-3' })).toEqual(['pic-1']);
    expect(await getPlayedPictureIds('en', { kind: 'public' })).toEqual([]);
    expect(await storedDeck()).toEqual([expect.objectContaining({ pictureId: 'pic-2' })]);
    expect(deletedFiles).toEqual(expect.arrayContaining(['file:///img.png']));
    expect(cacheList).not.toHaveBeenCalled();

    const [score] = await bufferedScores();
    expect(score.imageId).toBe('pic-1');
  });

  it('a failed orphan sweep keeps the win intact', async () => {
    await seedDeck();
    cacheList.mockImplementationOnce(() => {
      throw new Error('cache list boom');
    });

    await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

    expect(await bufferedScores()).toHaveLength(1);
    expect(await getPlayedPictureIds('en', baseArgs.scope)).toEqual(['pic-1']);
    expect(deletedFiles).toEqual(expect.arrayContaining(['file:///img.png']));
    expect(deletedFiles).not.toEqual(expect.arrayContaining([expect.stringContaining('pic-1.jpg')]));
  });
});
