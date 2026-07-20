jest.mock('../utils/handleGuessOutcome', () => ({
  resolveNextGuessParams: jest.fn(),
}));
jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));
jest.mock('../services/cardPrefetcher', () => ({
  warmAllDeckIfNeeded: jest.fn(),
}));

import { resolveNextGuessParams } from '../utils/handleGuessOutcome';
import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { warmAllDeckIfNeeded } from '../services/cardPrefetcher';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';

const resolveMock = resolveNextGuessParams as jest.MockedFunction<typeof resolveNextGuessParams>;
const fetchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;
const appendMock = appendCardBatch as jest.MockedFunction<typeof appendCardBatch>;
const warmMock = warmAllDeckIfNeeded as jest.MockedFunction<typeof warmAllDeckIfNeeded>;

const CARD_PARAMS = { listId: 9, pictureId: 'img-9', imageFile: 'file:///nine.jpg' };
const A_CARD_RESULT = { params: CARD_PARAMS };

const BASE_ARGS = {
  category: { id: 7, key: 'city' },
  language: 'fr',
  currentListId: 3,
  isTutorial: false,
  scope: { kind: 'public' },
  authContext: { token: 'x' },
};

describe('resolveNextCardWithServerFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    warmMock.mockResolvedValue(undefined as never);
    appendMock.mockResolvedValue(null as never);
  });

  it('returns the locally-resolved card without any server fetch when the deck has a next card', async () => {
    resolveMock.mockResolvedValue(A_CARD_RESULT as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result).toEqual(A_CARD_RESULT);
    expect(resolveMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
    expect(warmMock).not.toHaveBeenCalled();
  });

  it('foreground-fetches the current category when local is empty and the server still has cards, then returns the retried card', async () => {
    // 1st local resolve: empty (local deck drained faster than the prefetcher
    // topped it up). 2nd local resolve: the foreground top-up appended a card.
    resolveMock
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(A_CARD_RESULT as never);
    fetchMock.mockResolvedValue({ isError: false, images: [{ listId: 9 }] } as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result).toEqual(A_CARD_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
    }));
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(resolveMock).toHaveBeenCalledTimes(2);
    // No cross-fallback to 'all' — the current category still had server cards.
    expect(warmMock).not.toHaveBeenCalled();
  });

  it('cross-falls-back to the warmed "all" deck when a non-"all" category is exhausted both locally and on the server', async () => {
    // 1st resolve: local empty. foregroundTopUp fetches the category, server
    // returns no images → no append → afterFetch resolve is SKIPPED. 2nd
    // resolve: the warmed 'all' deck supplies a card.
    resolveMock
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(A_CARD_RESULT as never);
    // Current category server-exhausted: no images, so foregroundTopUp is a no-op.
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result).toEqual(A_CARD_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appendMock).not.toHaveBeenCalled();
    expect(warmMock).toHaveBeenCalledTimes(1);
    expect(warmMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'fr' }));
    expect(resolveMock).toHaveBeenCalledTimes(2);
  });

  it('loops back to already-played cards by re-fetching "all" from head when every tier is exhausted', async () => {
    // category='all', local empty, foreground fetch-beyond-cursor empty → the
    // looping tier re-fetches 'all' from HEAD (cursor null) and the server
    // returns the deck again (cards the player already did — the server holds
    // them; client-side plays are local-only). Appended with fresh listIds,
    // the retried resolve finds the first replayed card.
    resolveMock
      .mockResolvedValueOnce(null as never)   // local
      .mockResolvedValueOnce(A_CARD_RESULT as never); // after looping re-fetch
    // 1st fetch (foregroundTopUp, cursor=beyond): empty. 2nd fetch (loop, head): replay set.
    fetchMock
      .mockResolvedValueOnce({ isError: false, images: [] } as never)
      .mockResolvedValueOnce({ isError: false, images: [{ listId: 1 }, { listId: 2 }] } as never);

    const result = await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

    expect(result).toEqual(A_CARD_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The looping fetch must reset the cursor to head (pictureIdOverride: null)
    // and target the 'all' pool — that's what makes already-played cards return.
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      categoryKey: 'all',
      pictureIdOverride: null,
    }));
    expect(appendMock).toHaveBeenCalledTimes(1); // only the looping fetch appended
    expect(resolveMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when even the looping re-fetch from head yields no cards (server truly empty for the language)', async () => {
    // The only legitimate bounce: the server has no cards at all for the
    // language/scope, so even a head re-fetch returns nothing.
    resolveMock.mockResolvedValue(null as never);
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    const result = await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

    expect(result).toBeNull();
    // local fetch + looping head fetch, both empty.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(appendMock).not.toHaveBeenCalled();
  });
});
