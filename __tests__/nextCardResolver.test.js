jest.mock('../utils/storageDatum', () => ({
  getNextImageForScope: jest.fn(),
}));

import { getNextImageForScope } from '../utils/storageDatum';
import { resolveNextCard } from '../utils/nextCardResolver';
import { RECENT_ALL_CATEGORY } from '../constants/categories';

describe('resolveNextCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the in-category card with the original category and skips the All fallback', async () => {
    const category = { key: 'city', id: 7 };
    const card = { listId: 4, imageFile: 'file:///cache/4.jpg' };
    getNextImageForScope.mockResolvedValueOnce(card);

    const result = await resolveNextCard({ category, language: 'fr', currentListId: 3, scope: { kind: 'public' } });

    expect(result).toEqual({ card, category });
    expect(getNextImageForScope).toHaveBeenCalledTimes(1);
    expect(getNextImageForScope).toHaveBeenCalledWith({
      category,
      language: 'fr',
      currentListId: 3,
      scope: { kind: 'public' },
    });
  });

  it('falls back to the All deck with RECENT_ALL_CATEGORY when the category deck is exhausted', async () => {
    const category = { key: 'city', id: 7 };
    const allCard = { listId: 1, imageFile: 'file:///cache/all1.jpg' };
    getNextImageForScope
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(allCard);

    const result = await resolveNextCard({ category, language: 'fr', currentListId: 9, scope: { kind: 'public' } });

    expect(result).toEqual({ card: allCard, category: RECENT_ALL_CATEGORY });
    expect(getNextImageForScope).toHaveBeenCalledTimes(2);
    expect(getNextImageForScope).toHaveBeenNthCalledWith(1, {
      category,
      language: 'fr',
      currentListId: 9,
      scope: { kind: 'public' },
    });
    expect(getNextImageForScope).toHaveBeenNthCalledWith(2, {
      category: RECENT_ALL_CATEGORY,
      language: 'fr',
      currentListId: undefined,
      scope: { kind: 'public' },
    });
  });

  it('advances within All using the real currentListId (regression: must NOT always return images[0])', async () => {
    const card = { listId: 12, imageFile: 'file:///cache/12.jpg' };
    getNextImageForScope.mockResolvedValueOnce(card);

    const result = await resolveNextCard({
      category: RECENT_ALL_CATEGORY,
      language: 'en',
      currentListId: 11,
      scope: { kind: 'public' },
    });

    expect(result).toEqual({ card, category: RECENT_ALL_CATEGORY });
    expect(getNextImageForScope).toHaveBeenCalledTimes(1);
    expect(getNextImageForScope).toHaveBeenCalledWith({
      category: RECENT_ALL_CATEGORY,
      language: 'en',
      currentListId: 11,
      scope: { kind: 'public' },
    });
  });

  it('returns null when both the category deck and the All deck are empty', async () => {
    getNextImageForScope
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await resolveNextCard({
      category: { key: 'city', id: 7 },
      language: 'en',
      currentListId: 9,
      scope: { kind: 'public' },
    });

    expect(result).toBeNull();
    expect(getNextImageForScope).toHaveBeenCalledTimes(2);
  });

  it('returns null when already in All and the All deck is exhausted', async () => {
    getNextImageForScope.mockResolvedValueOnce(null);

    const result = await resolveNextCard({
      category: RECENT_ALL_CATEGORY,
      language: 'en',
      currentListId: 99,
      scope: { kind: 'public' },
    });

    expect(result).toBeNull();
    expect(getNextImageForScope).toHaveBeenCalledTimes(1);
  });
});
