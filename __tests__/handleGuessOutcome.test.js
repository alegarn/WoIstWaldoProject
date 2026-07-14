import { applySuccessSideEffects } from '../utils/handleGuessOutcome';
import { bufferScore, mintGuessId } from '../utils/sessionScoreStore';
import { removeImageFromList, deleteImageFromStorage } from '../utils/storageDatum';

jest.mock('../utils/sessionScoreStore', () => ({
  bufferScore: jest.fn(),
  mintGuessId: jest.fn(() => 'id-1'),
}));
jest.mock('../utils/storageDatum', () => ({
  removeImageFromList: jest.fn().mockResolvedValue(),
  deleteImageFromStorage: jest.fn().mockResolvedValue(),
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
});
