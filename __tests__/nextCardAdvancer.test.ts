jest.mock('../utils/handleGuessOutcome', () => ({
  resolveNextGuessParams: jest.fn(),
}));
jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));
jest.mock('../utils/storageDatum', () => ({
  getDeckCountForScope: jest.fn(),
  getRemainingDeckCount: jest.fn(),
  normalizeListIds: jest.fn((cards) => cards),
}));
jest.mock('../utils/e2eMode', () => ({ isE2EMode: jest.fn(() => false) }));
// PB4 (T2.7): use the REAL prefetchIfLow (with its inFlight Map) so the
// prefetch/foreground dedup is exercisable. warmAllDeckIfNeeded stays mocked
// so Tier 3 doesn't issue extra fetchCardBatch calls.
jest.mock('../services/cardPrefetcher', () => {
  const actual = jest.requireActual('../services/cardPrefetcher');
  return {
    ...actual,
    warmAllDeckIfNeeded: jest.fn(),
  };
});

import { resolveNextGuessParams } from '../utils/handleGuessOutcome';
import { fetchCardBatch, appendCardBatch } from '../services/cardDeck';
import { getDeckCountForScope, getRemainingDeckCount } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import { warmAllDeckIfNeeded, prefetchIfLow, __resetForTests } from '../services/cardPrefetcher';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';

const resolveMock = resolveNextGuessParams as jest.MockedFunction<typeof resolveNextGuessParams>;
const fetchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;
const appendMock = appendCardBatch as jest.MockedFunction<typeof appendCardBatch>;
const warmMock = warmAllDeckIfNeeded as jest.MockedFunction<typeof warmAllDeckIfNeeded>;
const countMock = getDeckCountForScope as jest.MockedFunction<typeof getDeckCountForScope>;
const remainingMock = getRemainingDeckCount as jest.MockedFunction<typeof getRemainingDeckCount>;
const e2eMock = isE2EMode as jest.MockedFunction<typeof isE2EMode>;

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
    __resetForTests();
    e2eMock.mockReturnValue(false);
    warmMock.mockResolvedValue(undefined as never);
    appendMock.mockResolvedValue(null as never);
    // Default: deck appears "full" to the prefetcher so prefetchIfLow no-ops
    // (returns before touching inFlight) for the existing Tier-2/3/4 tests.
    remainingMock.mockResolvedValue(100);
    countMock.mockResolvedValue(100);
  });

  it('returns the locally-resolved card without any server fetch when the deck has a next card', async () => {
    resolveMock.mockResolvedValue(A_CARD_RESULT as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    expect(resolveMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
    expect(warmMock).not.toHaveBeenCalled();
  });

  it('foreground-fetches the current category when local is empty and the server still has cards, then returns the retried card', async () => {
    // 1st local resolve: empty (Tier 1). 2nd resolve: Tier 2 recheck after the
    // prefetch-await (prefetcher no-ops in this test → deck still empty).
    // 3rd resolve: caller re-checks after foregroundTopUp's own fetch appended.
    resolveMock
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(A_CARD_RESULT as never);
    fetchMock.mockResolvedValue({ isError: false, images: [{ listId: 9 }] } as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
    }));
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(resolveMock).toHaveBeenCalledTimes(3);
    // No cross-fallback to 'all' — the current category still had server cards.
    expect(warmMock).not.toHaveBeenCalled();
  });

  it('cross-falls-back to the warmed "all" deck when a non-"all" category is exhausted both locally and on the server', async () => {
    // 1st resolve: local empty (Tier 1). 2nd resolve: Tier 2 recheck (still
    // empty after prefetch no-op). foregroundTopUp fetches the category, server
    // returns no images → no append → afterFetch resolve is SKIPPED. 3rd
    // resolve: the warmed 'all' deck supplies a card.
    resolveMock
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(A_CARD_RESULT as never);
    // Current category server-exhausted: no images, so foregroundTopUp is a no-op.
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appendMock).not.toHaveBeenCalled();
    expect(warmMock).toHaveBeenCalledTimes(1);
    expect(warmMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'fr' }));
    expect(resolveMock).toHaveBeenCalledTimes(3);
  });

  it('Tier 3 propagates currentListId to warmAllDeckIfNeeded (RC8/CB3/T2.8)', async () => {
    // Cursor-aware warm: Tier 3 must forward the advancer's currentListId so
    // warmAllDeckIfNeeded uses getRemainingDeckCount and detects a
    // cursor-exhausted 'all' deck (count=N>0 but no listId > currentListId).
    resolveMock
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(A_CARD_RESULT as never);
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(warmMock).toHaveBeenCalledTimes(1);
    expect(warmMock).toHaveBeenCalledWith(expect.objectContaining({
      currentListId: BASE_ARGS.currentListId,
    }));
  });

  it('Tier 2 awaits outside prefetch when cursor-filtered remaining-ahead is low even if total deck ≥ LOW_CARD_THRESHOLD (RC8)', async () => {
    // PB4 (T2.7) Option A: foregroundTopUp no longer triggers prefetchIfLow
    // itself — it only awaits an in-flight prefetch via getInFlightPrefetch.
    // So to verify the prefetcher's cursor-aware count drives the prefetch
    // (RC8: getRemainingDeckCount=2 < threshold despite getDeckCountForScope=100),
    // an outside caller must fire prefetchIfLow for the same scope. The
    // foreground path then awaits that in-flight promise and short-circuits
    // via the Tier 2 recheck — no separate foreground fetch.
    remainingMock.mockImplementation((args?: { category?: unknown }) => {
      const cat = args?.category as { key?: string } | string | null | undefined;
      const key = typeof cat === 'string' ? cat : cat?.key;
      return Promise.resolve(key === 'all' ? 100 : 2);
    });
    countMock.mockResolvedValue(100);
    resolveMock
      .mockResolvedValueOnce(null as never)            // Tier 1 empty
      .mockResolvedValueOnce(A_CARD_RESULT as never)   // Tier 2 recheck after prefetch lands
      .mockResolvedValueOnce(A_CARD_RESULT as never);  // caller recheck
    fetchMock.mockResolvedValue({ isError: false, images: [{ listId: 9 }] } as never);

    // Outside caller fires prefetchIfLow — the cursor-aware count (2 < 10)
    // drives the prefetch. warm's 'all' dedupKey returns count=100 > 0 so the
    // real warm (the export mock is bypassed for prefetchIfLow's internal
    // call) short-circuits without a 2nd fetch.
    const prefetchPromise = prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 'x' },
      currentListId: BASE_ARGS.currentListId,
    });
    const result = await resolveNextCardWithServerFallback(BASE_ARGS);
    await prefetchPromise;

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    // Cursor-aware count drove the prefetch; foreground short-circuit added no fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('loops back to already-played cards by re-fetching "all" from head when every tier is exhausted', async () => {
    // category='all'. 1st resolve: local empty (Tier 1). 2nd resolve: Tier 2
    // recheck (still empty). Tier 2 fetch (cursor=beyond): empty → no append.
    // Tier 3 skipped (categoryKey='all'). Tier 4 fetches 'all' from HEAD with
    // pictureIdOverride=null and the server returns the replay set; appended
    // with fresh listIds, the retried resolve finds the first replayed card.
    resolveMock
      .mockResolvedValueOnce(null as never)   // local
      .mockResolvedValueOnce(null as never)   // Tier 2 recheck (post-prefetch)
      .mockResolvedValueOnce(A_CARD_RESULT as never); // after looping re-fetch
    // 1st fetch (foregroundTopUp Tier 2, cursor=beyond): empty.
    // 2nd fetch (Tier 4 loop, head): replay set.
    fetchMock
      .mockResolvedValueOnce({ isError: false, images: [] } as never)
      .mockResolvedValueOnce({ isError: false, images: [{ listId: 1 }, { listId: 2 }] } as never);

    const result = await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The looping fetch must reset the cursor to head (pictureIdOverride: null)
    // and target the 'all' pool — that's what makes already-played cards return.
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      categoryKey: 'all',
      pictureIdOverride: null,
    }));
    expect(appendMock).toHaveBeenCalledTimes(1); // only the looping fetch appended
    expect(resolveMock).toHaveBeenCalledTimes(3);
  });

  it('returns null when even the looping re-fetch from head yields no cards (server truly empty for the language)', async () => {
    // The only legitimate bounce: the server has no cards at all for the
    // language/scope, so even a head re-fetch returns nothing.
    resolveMock.mockResolvedValue(null as never);
    fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

    const result = await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

    expect(result.next).toBeNull();
    expect(result.reason).toBe('empty');
    // local fetch + looping head fetch, both empty.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('returns reason=network when fetchCardBatch throws transiently', async () => {
    // foregroundTopUp's blanket catch is gone: a transient transport error is
    // surfaced as reason='network' rather than swallowed as a generic false.
    // Tier 2 recheck returns null (prefetcher no-op'd), Tier 2 fetch rejects
    // with TypeError, but the resolver falls through to the warmed 'all' deck
    // (Tier 3) and recovers — so the caller sees reason='ok'.
    resolveMock
      .mockResolvedValueOnce(null as never)            // local
      .mockResolvedValueOnce(null as never)            // Tier 2 recheck (post-prefetch)
      .mockResolvedValueOnce(A_CARD_RESULT as never);  // after warm-all
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch') as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appendMock).not.toHaveBeenCalled();
    expect(warmMock).toHaveBeenCalledTimes(1);
  });

  // ─── PB4 (T2.7) — fetch dedup above the writer ───────────────────────────
  //
  // Preflight: prefetchIfLow + foregroundTopUp (via resolveNextCardWithServerFallback)
  // both target the same scope. With the PB4 fix, foregroundTopUp awaits
  // prefetchIfLow's inFlight promise for the scope before issuing its own
  // fetch, so only one server round-trip occurs and the deck sees each
  // pictureId at most once.

  it('PB4: concurrent prefetchIfLow + foregroundTopUp → at most one server round-trip', async () => {
    // Deck is empty (Tier 1 + Tier 2 recheck return null), prefetcher will
    // fetch (remaining=0 < threshold), and the prefetch's cards become
    // visible to the caller's resolve once it lands.
    //
    // remainingMock is scoped so the real warmAllDeckIfNeeded (whose export
    // mock is bypassed for prefetchIfLow's INTERNAL call — they share the
    // same module-local binding) short-circuits on the 'all' deck (count > 0)
    // and does not issue a 2nd server fetch. The PB4 assertion is about
    // same-scope dedup between prefetch + foreground, not about warm.
    remainingMock.mockImplementation((args?: { category?: unknown }) => {
      const cat = args?.category as { key?: string } | string | null | undefined;
      const key = typeof cat === 'string' ? cat : cat?.key;
      return Promise.resolve(key === 'all' ? 100 : 0);
    });
    const batch = [
      { listId: 1, pictureId: 'pic-A' },
      { listId: 2, pictureId: 'pic-B' },
    ];
    fetchMock.mockResolvedValue({ isError: false, images: batch } as never);
    resolveMock
      .mockResolvedValueOnce(null as never)            // Tier 1
      .mockResolvedValueOnce(A_CARD_RESULT as never)   // Tier 2 recheck after prefetch lands
      .mockResolvedValueOnce(A_CARD_RESULT as never);  // caller recheck after short-circuit

    // Fire both concurrently against the same scope. foregroundTopUp's
    // getInFlightPrefetch must find the outside prefetchIfLow's inFlight
    // promise and await it — no 2nd fetch for the same scope.
    const prefetchPromise = prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 'x' },
    });
    const advancePromise = resolveNextCardWithServerFallback(BASE_ARGS);
    await Promise.all([prefetchPromise, advancePromise]);
    await Promise.resolve();

    // The dedup is the fix: one fetch total (the prefetch), and the
    // foreground path short-circuits via its post-prefetch recheck.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('PB4: no duplicate pictureIds when both fetches target the same scope', async () => {
    // Mock fetchCardBatch to return OVERLAPPING pictureIds on every call —
    // this is exactly what would happen if both fetches raced the same
    // server cursor. The dedup must prevent a second append with the same
    // pictureIds.
    //
    // remainingMock is scoped (see the prior PB4 test) so the real
    // warmAllDeckIfNeeded short-circuits on the 'all' deck and does not
    // issue a 2nd fetch that would pollute the pictureId uniqueness check.
    remainingMock.mockImplementation((args?: { category?: unknown }) => {
      const cat = args?.category as { key?: string } | string | null | undefined;
      const key = typeof cat === 'string' ? cat : cat?.key;
      return Promise.resolve(key === 'all' ? 100 : 0);
    });
    const overlapping = [
      { listId: 1, pictureId: 'pic-X' },
      { listId: 2, pictureId: 'pic-Y' },
    ];
    fetchMock.mockResolvedValue({ isError: false, images: overlapping } as never);
    resolveMock
      .mockResolvedValueOnce(null as never)            // Tier 1
      .mockResolvedValueOnce(A_CARD_RESULT as never)   // Tier 2 recheck after prefetch
      .mockResolvedValueOnce(A_CARD_RESULT as never);  // caller recheck

    const prefetchPromise = prefetchIfLow({
      categoryKey: 'city',
      categoryId: 7,
      language: 'fr',
      scope: { kind: 'public' },
      authContext: { token: 'x' },
    });
    const advancePromise = resolveNextCardWithServerFallback(BASE_ARGS);
    await Promise.all([prefetchPromise, advancePromise]);
    await Promise.resolve();

    // Only one appendCardBatch call (the prefetch's). A second call with the
    // same pictureIds would mean the foreground path bypassed the dedup.
    expect(appendMock).toHaveBeenCalledTimes(1);

    // Defense-in-depth: across ALL appendCardBatch calls (one or many), no
    // pictureId appears more than once in the flattened deck.
    const allCards = appendMock.mock.calls.flatMap((c) => (c[0] as { cards?: Array<{ pictureId?: string }> }).cards ?? []);
    const pictureIds = allCards.map((card) => card.pictureId).filter((id): id is string => Boolean(id));
    expect(new Set(pictureIds).size).toBe(pictureIds.length);
  });
});
