import { applySuccessSideEffects } from '../utils/handleGuessOutcome';
import { bufferScore, mintGuessId } from '../utils/sessionScoreStore';
import { removeImageFromList, deleteImageFromStorage, sweepPlayedOrphanCacheFiles } from '../utils/storageDatum';
import { addPlayedPictureId } from '../utils/playedPictureIds';

jest.mock('../utils/sessionScoreStore', () => ({
  bufferScore: jest.fn(),
  mintGuessId: jest.fn(() => 'id-1'),
}));
jest.mock('../utils/storageDatum', () => ({
  removeImageFromList: jest.fn().mockResolvedValue(),
  deleteImageFromStorage: jest.fn().mockResolvedValue(),
  sweepPlayedOrphanCacheFiles: jest.fn().mockResolvedValue(),
}));
jest.mock('../utils/playedPictureIds', () => ({
  addPlayedPictureId: jest.fn(() => Promise.resolve()),
}));
jest.mock('../utils/nextCardResolver', () => ({ resolveNextCard: jest.fn() }));

const baseArgs = {
  listId: 'list-1',
  categoryKey: 'animals',
  language: 'en',
  imageFile: 'file:///img.png',
  pictureId: 'pic-1',
  scope: { kind: 'public' },
  userId: 'user-1',
};

describe('applySuccessSideEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to points=1 and omits multiplier when not passed', async () => {
    await applySuccessSideEffects(baseArgs);

    expect(bufferScore).toHaveBeenCalledTimes(1);
    const arg = bufferScore.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ points: 1 }));
    expect('multiplier' in arg).toBe(false);
  });

  it('threads points and multiplier into the buffered item', async () => {
    await applySuccessSideEffects({ ...baseArgs, points: 2, multiplier: 2 });

    expect(bufferScore).toHaveBeenCalledTimes(1);
    const arg = bufferScore.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({
      points: 2,
      multiplier: 2,
      guessId: 'id-1',
      pictureId: 'pic-1',
      userId: 'user-1',
      ts: expect.any(Number),
    }));
    expect(mintGuessId).toHaveBeenCalled();
  });

  it('keeps buffering the score when storage cleanup throws', async () => {
    removeImageFromList.mockRejectedValueOnce(new Error('boom'));

    await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

    expect(bufferScore).toHaveBeenCalledTimes(1);
    expect(deleteImageFromStorage).not.toHaveBeenCalled();
  });

  it('defaults streak to 0 and omits streakMultiplier when not passed', async () => {
    await applySuccessSideEffects(baseArgs);

    const arg = bufferScore.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ streak: 0 }));
    expect('streakMultiplier' in arg).toBe(false);
  });

  it('threads streak and streakMultiplier into the buffered item', async () => {
    await applySuccessSideEffects({ ...baseArgs, streak: 5, streakMultiplier: 1.5 });

    const arg = bufferScore.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ streak: 5, streakMultiplier: 1.5 }));
  });

  it('threads streak without streakMultiplier when only streak is passed', async () => {
    await applySuccessSideEffects({ ...baseArgs, streak: 5 });

    const arg = bufferScore.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ streak: 5 }));
    expect('streakMultiplier' in arg).toBe(false);
  });

  it('(l) win records the played pictureId in the played-set (fire-and-forget, failure kept silent)', async () => {
    addPlayedPictureId.mockRejectedValueOnce(new Error('played write failed'));

    await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

    expect(addPlayedPictureId).toHaveBeenCalledWith('pic-1', 'en', { kind: 'public' });
    expect(removeImageFromList).toHaveBeenCalledWith('list-1', 'animals', 'en');
    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///img.png');
  });

  it('Task 2b: a public win runs the played-orphan sweep after the winner file is deleted', async () => {
    await applySuccessSideEffects(baseArgs);

    expect(sweepPlayedOrphanCacheFiles).toHaveBeenCalledTimes(1);
    expect(sweepPlayedOrphanCacheFiles).toHaveBeenCalledWith('en');
    expect(deleteImageFromStorage.mock.invocationCallOrder[0])
      .toBeLessThan(sweepPlayedOrphanCacheFiles.mock.invocationCallOrder[0]);
  });

  it('Task 2b: a private win skips the public sweep (private-* files are swept by purgeAllPrivateCaches)', async () => {
    await applySuccessSideEffects({ ...baseArgs, scope: { kind: 'private', groupId: 'g-3' } });

    expect(sweepPlayedOrphanCacheFiles).not.toHaveBeenCalled();
  });

  it('Task 2b: a sweep failure is best-effort (score kept, win already applied)', async () => {
    sweepPlayedOrphanCacheFiles.mockRejectedValueOnce(new Error('sweep boom'));

    await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///img.png');
  });
});
