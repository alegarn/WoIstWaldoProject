jest.mock('../utils/sessionScoreStore', () => ({
  bufferScore: jest.fn(),
  mintGuessId: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  removeImageFromList: jest.fn(),
  deleteImageFromStorage: jest.fn(),
}));

jest.mock('../utils/nextCardResolver', () => ({
  resolveNextCard: jest.fn(),
}));

import { bufferScore, mintGuessId } from '../utils/sessionScoreStore';
import { removeImageFromList, deleteImageFromStorage } from '../utils/storageDatum';
import { resolveNextCard } from '../utils/nextCardResolver';
import { applySuccessSideEffects, resolveNextGuessParams } from '../utils/handleGuessOutcome';

describe('handleGuessOutcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mintGuessId.mockReturnValue('guess-1');
    bufferScore.mockResolvedValue(undefined);
    removeImageFromList.mockResolvedValue(undefined);
    deleteImageFromStorage.mockResolvedValue(undefined);
    resolveNextCard.mockReset();
  });

  describe('applySuccessSideEffects', () => {
    const baseArgs = {
      listId: 7,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///cache/waldo.jpg',
      pictureId: 'pic-1',
      scope: { kind: 'public' },
      userId: 'user-1',
    };

    it('buffers the score with the exact item shape (public scope: imageId undefined)', async () => {
      await applySuccessSideEffects(baseArgs);

      expect(bufferScore).toHaveBeenCalledTimes(1);
      expect(bufferScore).toHaveBeenCalledWith({
        guessId: 'guess-1',
        imageName: 'pic-1',
        imageId: undefined,
        pictureId: 'pic-1',
        scope: { kind: 'public' },
        points: 1,
        ts: expect.any(Number),
        userId: 'user-1',
      });
    });

    it('uses pictureId as imageId for private scope', async () => {
      await applySuccessSideEffects({ ...baseArgs, scope: { kind: 'private', groupId: 'g-3' } });

      expect(bufferScore).toHaveBeenCalledWith(expect.objectContaining({
        imageName: 'pic-1',
        imageId: 'pic-1',
        pictureId: 'pic-1',
      }));
    });

    it('removes the image from the persisted list with exact 3 args in order', async () => {
      await applySuccessSideEffects(baseArgs);

      expect(removeImageFromList).toHaveBeenCalledTimes(1);
      expect(removeImageFromList).toHaveBeenCalledWith(7, 'nature', 'fr');
    });

    it('deletes the cached image file', async () => {
      await applySuccessSideEffects(baseArgs);

      expect(deleteImageFromStorage).toHaveBeenCalledTimes(1);
      expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///cache/waldo.jpg');
    });

    it('buffers the score BEFORE removing the image from the list', async () => {
      await applySuccessSideEffects(baseArgs);

      expect(bufferScore.mock.invocationCallOrder[0]).toBeLessThan(
        removeImageFromList.mock.invocationCallOrder[0]
      );
    });

    it('resolves and keeps the buffered score when removeImageFromList rejects (no rollback, no rethrow)', async () => {
      removeImageFromList.mockRejectedValueOnce(new Error('boom-list'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

      expect(bufferScore).toHaveBeenCalledTimes(1);
      expect(removeImageFromList).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('resolves and keeps the buffered score when deleteImageFromStorage throws (no rollback, no rethrow)', async () => {
      deleteImageFromStorage.mockRejectedValueOnce(new Error('boom-file'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(applySuccessSideEffects(baseArgs)).resolves.toBeUndefined();

      expect(bufferScore).toHaveBeenCalledTimes(1);
      expect(deleteImageFromStorage).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('resolveNextGuessParams', () => {
    it('returns params with hiddenLocation alias, skipInstructions true, and scope only when private', async () => {
      const category = { key: 'city', id: 7 };
      const card = { listId: 4, imageFile: 'file:///cache/4.jpg', touchLocation: { x: 0.5, y: 0.5 } };
      resolveNextCard.mockResolvedValueOnce({ card, category });

      const result = await resolveNextGuessParams({
        category,
        language: 'fr',
        currentListId: 3,
        isTutorial: false,
        scope: { kind: 'private', groupId: 'g-3' },
      });

      expect(result).not.toBeNull();
      expect(result.params).toEqual(expect.objectContaining({
        listId: 4,
        imageFile: 'file:///cache/4.jpg',
        hiddenLocation: { x: 0.5, y: 0.5 },
        category,
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
        scope: { kind: 'private', groupId: 'g-3' },
      }));
    });

    it('omits scope for a public deck', async () => {
      const category = { key: 'city', id: 7 };
      const card = { listId: 4, touchLocation: { x: 0.1, y: 0.2 } };
      resolveNextCard.mockResolvedValueOnce({ card, category });

      const result = await resolveNextGuessParams({
        category,
        language: 'en',
        currentListId: 1,
        isTutorial: true,
        scope: { kind: 'public' },
      });

      expect(result).not.toBeNull();
      expect(result.params).not.toHaveProperty('scope');
      expect(result.params.skipInstructions).toBe(true);
      expect(result.params.hiddenLocation).toEqual({ x: 0.1, y: 0.2 });
    });

    it('returns null when resolveNextCard returns null', async () => {
      resolveNextCard.mockResolvedValueOnce(null);

      const result = await resolveNextGuessParams({
        category: { key: 'all' },
        language: 'en',
        currentListId: 99,
        isTutorial: false,
        scope: { kind: 'public' },
      });

      expect(result).toBeNull();
    });
  });
});
