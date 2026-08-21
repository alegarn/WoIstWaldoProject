jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));
jest.mock('../utils/storageDatum', () => ({
  getRemainingDeckCount: jest.fn(),
  normalizeListIds: jest.fn((cards) => cards),
  isCategoryExhausted: jest.fn().mockResolvedValue(false),
  markCategoryExhausted: jest.fn().mockResolvedValue(undefined),
  updateImageList: jest.fn().mockResolvedValue([]),
  clearExhaustedCategory: jest.fn().mockResolvedValue(undefined),
  // Fix 2b: the real appendCardBatch (Fix 1 pin) filters played cards through
  // this helper before dedup — passthrough keeps the pin's semantics.
  filterPlayedCards: jest.fn((cards) => Promise.resolve(cards)),
}));
jest.mock('../utils/e2eMode', () => ({ isE2EMode: jest.fn(() => false) }));

import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { getRemainingDeckCount, normalizeListIds, isCategoryExhausted, markCategoryExhausted, clearExhaustedCategory } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import {
  LOW_CARD_THRESHOLD,
  TARGET_BATCH_SIZE,
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
const isExhaustedMock = isCategoryExhausted as jest.MockedFunction<typeof isCategoryExhausted>;
const markExhaustedMock = markCategoryExhausted as jest.MockedFunction<typeof markCategoryExhausted>;
const clearExhaustedMock = clearExhaustedCategory as jest.MockedFunction<typeof clearExhaustedCategory>;

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
    isExhaustedMock.mockResolvedValue(false);
    markExhaustedMock.mockResolvedValue(undefined);
  });

  it('exports LOW_CARD_THRESHOLD equal to 4 (refill at ≤3 remaining)', () => {
    expect(LOW_CARD_THRESHOLD).toBe(4);
  });

  it('exports TARGET_BATCH_SIZE equal to 5 (single source of truth for category top-up + all-deck fill)', () => {
    expect(TARGET_BATCH_SIZE).toBe(5);
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

  it('fires prefetch when count === 3 (the previously-broken boundary)', async () => {
    remainingMock.mockResolvedValue(3);

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: { token: 'x' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('warms the "all" deck in addition to the category fetch when the total deck is below TARGET_BATCH_SIZE', async () => {
    // count=0 + category returns 3 (IMAGES) = 3 < TARGET_BATCH_SIZE=5 → top-up
    // of 2 fires from 'all'. Pins the (count + appendedCount) gate at deck level.
    remainingMock.mockResolvedValueOnce(0);
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

  it('does not re-warm while the persisted "all" deck already has >= TARGET_BATCH_SIZE cards', async () => {
    // B1/F1: the gate is now `count >= target` (was `count > 0`). A partial
    // 'all' deck (e.g. 2 cards) MUST top up to TARGET_BATCH_SIZE=5; only a
    // deck already at >= target short-circuits.
    remainingMock.mockResolvedValueOnce(0).mockResolvedValueOnce(TARGET_BATCH_SIZE);
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

  it('warmAllDeckIfNeeded short-circuits when cursor-filtered remaining >= target (RC8/CB3 + B1 gate)', async () => {
    // B1/F1: the early-return gate is now `count >= target` (default
    // TARGET_BATCH_SIZE=5). Same persisted 'all' deck semantics as before —
    // the cursor-aware count is consulted with currentListId and short-
    // circuits when the deck already has enough cards ahead of the cursor.
    remainingMock.mockResolvedValue(TARGET_BATCH_SIZE);

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

  // ─── B1 / F1: download 5 at once, topping up from 'all' ───

  it('B1(a): category returns 2 + count=0 → fetches 3 from "all" to reach TARGET_BATCH_SIZE=5', async () => {
    remainingMock.mockResolvedValue(0); // count=0; 'all' count=0
    fetchMock.mockImplementation((params) =>
      okResponse(
        (params as { categoryKey: string }).categoryKey === 'all'
          ? [{ listId: 100 }, { listId: 101 }, { listId: 102 }]
          : [{ listId: 1 }, { listId: 2 }],
      ),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    const categoryCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'city');
    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(categoryCalls).toHaveLength(1);
    expect(allCalls).toHaveLength(1);
    // count(0) + appended(2) = 2 → target = 5 - 2 = 3
    expect(allCalls[0]![0]).toMatchObject({ categoryKey: 'all', language: 'fr' });
  });

  it('B1(b): category returns 5 → no "all" top-up (total deck already at target)', async () => {
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation(() => okResponse([
      { listId: 1 }, { listId: 2 }, { listId: 3 }, { listId: 4 }, { listId: 5 },
    ]));

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCalls).toHaveLength(0);
  });

  it('B1(c): category known-empty (isCategoryExhausted true) → skips category fetch, fetches 5 from "all"', async () => {
    isExhaustedMock.mockResolvedValue(true);
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation((params) =>
      okResponse(
        (params as { categoryKey: string }).categoryKey === 'all'
          ? [{ listId: 100 }, { listId: 101 }, { listId: 102 }, { listId: 103 }, { listId: 104 }]
          : [],
      ),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(isExhaustedMock).toHaveBeenCalledWith('city', 'fr', { kind: 'public' });
    const categoryCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'city');
    const allCalls = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(categoryCalls).toHaveLength(0);
    expect(allCalls).toHaveLength(1);
  });

  it('B1(d): categoryKey === "all" → never tops up (single fetch, single cycle)', async () => {
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation(() => okResponse([{ listId: 1 }]));

    await prefetchIfLow({ categoryKey: 'all', language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isExhaustedMock).not.toHaveBeenCalled();
  });

  it('B1(e): category fetch returns 0 + non-"all" → markCategoryExhausted called (prefetcher writes cache)', async () => {
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation((params) =>
      okResponse((params as { categoryKey: string }).categoryKey === 'all' ? [{ listId: 100 }] : []),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(markExhaustedMock).toHaveBeenCalledWith('city', 'fr', { kind: 'public' });
  });

  it('Fix 1 pin: prefetch that lands ≥1 card calls clearExhaustedCategory (via appendCardBatch)', async () => {
    // Wire the REAL appendCardBatch behind the mocked cardDeck export so the
    // prefetch → append chain exercises the marker clear end-to-end.
    appendMock.mockImplementation(jest.requireActual('../services/cardDeck').appendCardBatch as never);
    remainingMock.mockResolvedValue(2);

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(clearExhaustedMock).toHaveBeenCalledWith('city', 'fr', { kind: 'public' });
  });

  it('B1(e-CC4): isError (5xx) → markCategoryExhausted NOT called (transient blip must not poison cache)', async () => {
    remainingMock.mockResolvedValue(0);
    fetchMock.mockImplementation((params) =>
      (params as { categoryKey: string }).categoryKey === 'all'
        ? okResponse([{ listId: 100 }])
        : Promise.resolve({ isError: true } as never),
    );

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    expect(markExhaustedMock).not.toHaveBeenCalled();
  });

  it('B1(f): deck-level gate pin — count=2 + category returns 2 → fetches 1 from "all"; count=2 + category returns 4 → no top-up', async () => {
    // Branch 1: count=2 + appended=2 = 4 < 5 → top-up of 1.
    remainingMock.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    fetchMock.mockImplementationOnce(() => okResponse([{ listId: 1 }, { listId: 2 }]));
    fetchMock.mockImplementation(() => okResponse([{ listId: 100 }]));

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    const allCallsBranch1 = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCallsBranch1).toHaveLength(1);

    __resetForTests();
    jest.clearAllMocks();
    e2eMock.mockReturnValue(false);
    remainingMock.mockResolvedValue(0);
    isExhaustedMock.mockResolvedValue(false);

    // Branch 2: count=2 + appended=4 = 6 >= 5 → no top-up.
    remainingMock.mockResolvedValueOnce(2);
    fetchMock.mockImplementation(() => okResponse([{ listId: 1 }, { listId: 2 }, { listId: 3 }, { listId: 4 }]));

    await prefetchIfLow({ categoryKey: 'city', categoryId: 7, language: 'fr', scope: { kind: 'public' }, authContext: {} });
    await Promise.resolve();
    await Promise.resolve();

    const allCallsBranch2 = fetchMock.mock.calls.filter((c) => c[0]?.categoryKey === 'all');
    expect(allCallsBranch2).toHaveLength(0);
  });
});
