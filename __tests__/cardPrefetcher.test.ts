jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));
jest.mock('../utils/storageDatum', () => ({
  getRemainingDeckCount: jest.fn(),
  normalizeListIds: jest.fn((cards) => cards),
}));
jest.mock('../utils/e2eMode', () => ({ isE2EMode: jest.fn(() => false) }));

import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { getRemainingDeckCount, normalizeListIds } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import {
  LOW_CARD_THRESHOLD,
  ALL_WARM_THRESHOLD,
  LOOKAHEAD_PREFETCH,
  prefetchIfLow,
  warmAllDeckIfNeeded,
  __resetForTests,
} from '../services/cardPrefetcher';

const fetchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;
const appendMock = appendCardBatch as jest.MockedFunction<typeof appendCardBatch>;
const remainingMock = getRemainingDeckCount as jest.MockedFunction<typeof getRemainingDeckCount>;
const e2eMock = isE2EMode as jest.MockedFunction<typeof isE2EMode>;
const normalizeMock = normalizeListIds as jest.MockedFunction<typeof normalizeListIds>;

const IMAGES = [{ listId: 1 }, { listId: 2 }, { listId: 3 }];

function okResponse(images = IMAGES) {
  return Promise.resolve({ isError: false, images });
}

describe('cardPrefetcher', () => {
  beforeEach(() => {
    __resetForTests();
    jest.clearAllMocks();
    e2eMock.mockReturnValue(false);
    remainingMock.mockResolvedValue(0);
    fetchMock.mockResolvedValue({ isError: false, images: IMAGES } as never);
    appendMock.mockResolvedValue(null as never);
  });

  it('exports LOW_CARD_THRESHOLD equal to 3 (lowered for warmer decode pipeline)', () => {
    expect(LOW_CARD_THRESHOLD).toBe(3);
  });

  it('exports ALL_WARM_THRESHOLD equal to 5 (intentionally unchanged)', () => {
    expect(ALL_WARM_THRESHOLD).toBe(5);
  });

  it('exports LOOKAHEAD_PREFETCH equal to 3', () => {
    expect(LOOKAHEAD_PREFETCH).toBe(3);
  });

  it('does not fetch when count >= LOW_CARD_THRESHOLD', async () => {
    remainingMock.mockResolvedValue(12);

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('fetches and appends when count < LOW_CARD_THRESHOLD', async () => {
    remainingMock.mockResolvedValue(2);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: { token: 'x' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith({
      categoryKey: 'all',
      categoryId: undefined,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 'x' },
    });
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith({
      cards: IMAGES,
      categoryKey: 'all',
      categoryId: undefined,
      language: 'fr',
      scope: { kind: 'public' },
    });
  });

  it('skips append when fetchCardBatch returns isError', async () => {
    remainingMock.mockResolvedValue(2);
    fetchMock.mockResolvedValue({ isError: true } as never);

    await expect(
      prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} }),
    ).resolves.toBeUndefined();

    expect(appendMock).not.toHaveBeenCalled();
  });

  it('swallows errors from fetchCardBatch', async () => {
    remainingMock.mockResolvedValue(2);
    fetchMock.mockRejectedValue(new Error('network down') as never);

    await expect(
      prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} }),
    ).resolves.toBeUndefined();

    expect(appendMock).not.toHaveBeenCalled();
  });

  it('dedups concurrent calls for the same deck key (one fetchCardBatch total)', async () => {
    remainingMock.mockResolvedValue(2);
    fetchMock.mockImplementation(() => okResponse());

    const a = prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    const b = prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });

    await Promise.all([a, b]);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows a new prefetch after the in-flight promise resolves (dedup cleared)', async () => {
    remainingMock.mockResolvedValue(2);
    fetchMock.mockImplementation(() => okResponse());

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warms the "all" deck in addition to the category fetch when categoryKey !== "all" and count is low', async () => {
    remainingMock.mockResolvedValueOnce(2);
    remainingMock.mockResolvedValueOnce(0);
    fetchMock.mockImplementation((params) =>
      okResponse((params as { categoryKey: string }).categoryKey === 'all' ? [{ listId: 100 }] : IMAGES),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const allCall = fetchMock.mock.calls.find((c) => c[0]?.categoryKey === 'all');
    expect(allCall).toBeDefined();
    expect(allCall![0]).toMatchObject({ categoryKey: 'all', language: 'fr' });

    const allAppend = appendMock.mock.calls.find((c) => c[0]?.categoryKey === 'all');
    expect(allAppend).toBeDefined();
    expect(allAppend![0]).toMatchObject({ cards: [{ listId: 100 }], categoryKey: 'all' });
  });

  it('does not re-warm while the persisted "all" deck still has cards', async () => {
    remainingMock.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('cold-starts the all-deck warm from the head when the persisted all deck is empty', async () => {
    remainingMock.mockResolvedValueOnce(0);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).toHaveBeenCalledWith({
      categoryKey: 'all',
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
      pictureIdOverride: null,
    });
  });

  it('does not warm when categoryKey === "all"', async () => {
    remainingMock.mockResolvedValue(2);
    fetchMock.mockImplementation(() => okResponse());

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatchObject({ categoryKey: 'all' });
  });

  it('is a no-op in e2e mode (prefetchIfLow)', async () => {
    e2eMock.mockReturnValue(true);

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(remainingMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('prefetchIfLow passes currentListId through to getRemainingDeckCount', async () => {
    remainingMock.mockResolvedValue(7);

    await prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
      currentListId: 42,
    });

    expect(remainingMock).toHaveBeenCalledTimes(1);
    expect(remainingMock).toHaveBeenCalledWith({
      category: { key: 'city', id: 7 },
      language: 'fr',
      currentListId: 42,
      scope: { kind: 'public' },
    });
  });

  it('prefetchIfLow forwards currentListId: undefined when not provided (cursor-agnostic)', async () => {
    remainingMock.mockResolvedValue(7);

    await prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
    });

    expect(remainingMock).toHaveBeenCalledWith(expect.objectContaining({
      currentListId: undefined,
    }));
  });

  it('is a no-op in e2e mode (warmAllDeckIfNeeded)', async () => {
    e2eMock.mockReturnValue(true);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('warm-all retries on failure', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('net down') as never));

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('warm-all is awaitable and shares in-flight promise across concurrent callers', async () => {
    fetchMock.mockImplementation(() => okResponse());

    const p = warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    expect(p).toBeInstanceOf(Promise);

    const p2 = warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    await Promise.all([p, p2]);

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(1);
  });

  it('warm-all fetches again when the persisted all deck drains back to zero', async () => {
    remainingMock.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    expect(appendMock).toHaveBeenCalledTimes(1);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).toHaveBeenCalledTimes(2);
  });

  it('warm-all with empty result retries on the next call', async () => {
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(2);
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('prefetcher normalizeListIds is called on fetched cards before append (T2.6 defense-in-depth)', async () => {
    remainingMock.mockResolvedValue(2);
    normalizeMock.mockImplementation((cards) => cards);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(normalizeMock).toHaveBeenCalledTimes(1);
    expect(normalizeMock).toHaveBeenCalledWith(IMAGES);
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({ cards: IMAGES }));
  });

  it('warmAllDeckIfNeeded uses cursor-filtered count (RC8/CB3): count=N>0 but no listId > currentListId → fires warm (not short-circuited)', async () => {
    // Without T2.8, warmAllDeckIfNeeded called getDeckCountForScope which
    // returns the TOTAL 'all' deck size (5 here). The cursor is exhausted
    // (no listId > currentListId=42), so the cursor-aware count is 0. With
    // the T2.8 swap, warm fires; under the old bug it would short-circuit
    // and Tier 3 would return empty.
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation(() => okResponse());

    await warmAllDeckIfNeeded({
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
      currentListId: 42,
    });

    expect(remainingMock).toHaveBeenCalledWith({
      category: { key: 'all' },
      language: 'fr',
      currentListId: 42,
      scope: { kind: 'public' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: 'all' }));
  });

  it('warmAllDeckIfNeeded short-circuits when cursor-filtered remaining > 0 (RC8/CB3)', async () => {
    // Same persisted 'all' deck, but now listId=10 leaves cursor-ahead cards
    // (listIds 11+). The cursor-aware count is 2 → warm short-circuits even
    // though a count-only check would also have short-circuited; this test
    // pins that the cursor-aware path still gates correctly when ahead > 0.
    remainingMock.mockResolvedValue(2);

    await warmAllDeckIfNeeded({
      language: 'fr',
      scope: { kind: 'public' },
      authContext: {},
      currentListId: 10,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('warmAllDeckIfNeeded forwards currentListId: undefined when not provided (cursor-agnostic)', async () => {
    remainingMock.mockResolvedValue(0);

    await warmAllDeckIfNeeded({ language: 'fr', scope: { kind: 'public' }, authContext: {} });

    expect(remainingMock).toHaveBeenCalledWith(expect.objectContaining({
      currentListId: undefined,
    }));
  });
});
