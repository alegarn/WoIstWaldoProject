jest.mock('../utils/storageDatum', () => ({
  getLastImageUuid: jest.fn(),
  storeImageList: jest.fn(),
  updateImageList: jest.fn(),
}));

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => ({
  readGroupFeedCache: jest.fn(),
  writeGroupFeedCache: jest.fn(),
}));

import { updateImageList } from '../utils/storageDatum';
import { readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { appendCardBatch } from '../services/cardDeck';

describe('appendCardBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateImageList.mockResolvedValue([]);
    writeGroupFeedCache.mockResolvedValue(undefined);
    readGroupFeedCache.mockResolvedValue(null);
  });

  it('delegates to updateImageList on the public scope and skips the group feed cache', async () => {
    const cards = [{ listId: 1 }, { listId: 2 }];

    await appendCardBatch({ cards, categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' } });

    expect(updateImageList).toHaveBeenCalledWith(cards, 'city', 'fr');
    expect(writeGroupFeedCache).not.toHaveBeenCalled();
    expect(readGroupFeedCache).not.toHaveBeenCalled();
  });

  it('reads, concatenates, and writes the merged deck on the private scope without calling updateImageList', async () => {
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1 }, { listId: 2 }],
      nextCursor: 'cursor-1',
    });
    const cards = [{ listId: 3 }, { listId: 4 }];

    await appendCardBatch({
      cards,
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: 7, language: 'fr' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ listId: 1 }, { listId: 2 }, { listId: 3 }, { listId: 4 }], nextCursor: 'cursor-1' },
    );
    expect(updateImageList).not.toHaveBeenCalled();
  });

  it('writes the incoming cards as-is when the private cache is empty or missing', async () => {
    readGroupFeedCache.mockResolvedValueOnce(null);
    const cards = [{ listId: 5 }];

    await appendCardBatch({
      cards,
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      { images: [{ listId: 5 }], nextCursor: null },
    );
  });

  it('preserves the existing nextCursor when appending to a private cache', async () => {
    readGroupFeedCache.mockResolvedValueOnce({
      images: [{ listId: 1 }],
      nextCursor: { page: 2 },
    });

    await appendCardBatch({
      cards: [{ listId: 2 }],
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: 7, language: 'fr' },
      { images: [{ listId: 1 }, { listId: 2 }], nextCursor: { page: 2 } },
    );
  });

  it('returns null to match persistCardBatch', async () => {
    await expect(
      appendCardBatch({ cards: [], categoryKey: 'all', language: 'fr', scope: { kind: 'public' } }),
    ).resolves.toBe(null);

    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
    await expect(
      appendCardBatch({ cards: [], categoryKey: 'all', language: 'fr', scope: { kind: 'private', groupId: 'g-3' } }),
    ).resolves.toBe(null);
  });

  it('normalizes an undefined language to "any" before forwarding to delegates', async () => {
    const cards = [{ listId: 1 }];

    await appendCardBatch({ cards, categoryKey: 'all', scope: { kind: 'public' } });

    expect(updateImageList).toHaveBeenCalledWith(cards, 'all', 'any');

    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });
    await appendCardBatch({
      cards,
      categoryKey: 'all',
      scope: { kind: 'private', groupId: 'g-9' },
    });

    expect(readGroupFeedCache).toHaveBeenLastCalledWith('g-9', { categoryId: undefined, language: 'any' });
    expect(writeGroupFeedCache).toHaveBeenLastCalledWith(
      'g-9',
      { categoryId: undefined, language: 'any' },
      { images: cards, nextCursor: null },
    );
  });

  it('resolves an "all" categoryId to undefined for both private and public scopes', async () => {
    readGroupFeedCache.mockResolvedValueOnce({ images: [], nextCursor: null });

    await appendCardBatch({
      cards: [{ listId: 1 }],
      categoryKey: 'all',
      categoryId: 'all',
      language: 'fr',
      scope: { kind: 'private', groupId: 'g-3' },
    });

    expect(readGroupFeedCache).toHaveBeenCalledWith('g-3', { categoryId: undefined, language: 'fr' });
    expect(writeGroupFeedCache).toHaveBeenCalledWith(
      'g-3',
      { categoryId: undefined, language: 'fr' },
      expect.objectContaining({ images: [{ listId: 1 }] }),
    );
  });
});
