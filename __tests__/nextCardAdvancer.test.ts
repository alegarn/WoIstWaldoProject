jest.mock('../utils/handleGuessOutcome', () => ({
  resolveNextGuessParams: jest.fn(),
}));
jest.mock('../services/cardDeck', () => ({
  fetchCardBatch: jest.fn(),
  appendCardBatch: jest.fn(),
}));

let mockFileExists = true;
jest.mock('expo-file-system', () => {
  const File = jest.fn().mockImplementation(function MockFile(this: { uri: string | undefined; exists: boolean; delete: jest.Mock }, firstArg: string | { uri?: string }, secondArg?: string) {
    const baseUri = typeof firstArg === 'string' ? firstArg : firstArg?.uri;
    this.uri = secondArg ? `${baseUri}${secondArg}` : baseUri;
    this.exists = mockFileExists;
    this.delete = jest.fn();
  });
  return {
    File,
    Paths: class MockPaths {
      static get cache() {
        return { uri: 'file:///cache/' };
      }
    },
  };
});
jest.mock('../utils/storageDatum', () => {
  const actual = jest.requireActual('../utils/storageDatum');
  return {
    ...actual,
    getDeckCountForScope: jest.fn(),
    getRemainingDeckCount: jest.fn(),
    normalizeListIds: jest.fn((cards) => cards),
    isCategoryExhausted: jest.fn(),
    markCategoryExhausted: jest.fn(),
    clearExhaustedCategory: jest.fn((categoryKey: string, language: string | null | undefined, scope: unknown) =>
      actual.clearExhaustedCategory(categoryKey, language, scope)),
  };
});
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
import { getDeckCountForScope, getRemainingDeckCount, normalizeListIds, isCategoryExhausted, markCategoryExhausted, clearExhaustedCategory } from '../utils/storageDatum';
import { isE2EMode } from '../utils/e2eMode';
import { warmAllDeckIfNeeded, prefetchIfLow, __resetForTests } from '../services/cardPrefetcher';
import { resolveNextCardWithServerFallback } from '../utils/nextCardAdvancer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resolveMock = resolveNextGuessParams as jest.MockedFunction<typeof resolveNextGuessParams>;
const fetchMock = fetchCardBatch as jest.MockedFunction<typeof fetchCardBatch>;
const appendMock = appendCardBatch as jest.MockedFunction<typeof appendCardBatch>;
const warmMock = warmAllDeckIfNeeded as jest.MockedFunction<typeof warmAllDeckIfNeeded>;
const countMock = getDeckCountForScope as jest.MockedFunction<typeof getDeckCountForScope>;
const remainingMock = getRemainingDeckCount as jest.MockedFunction<typeof getRemainingDeckCount>;
const e2eMock = isE2EMode as jest.MockedFunction<typeof isE2EMode>;
const normalizeMock = normalizeListIds as jest.MockedFunction<typeof normalizeListIds>;
const isExhaustedMock = isCategoryExhausted as jest.MockedFunction<typeof isCategoryExhausted>;
const markExhaustedMock = markCategoryExhausted as jest.MockedFunction<typeof markCategoryExhausted>;
const clearExhaustedMock = clearExhaustedCategory as jest.MockedFunction<typeof clearExhaustedCategory>;

// jest.setup.js globally mocks AsyncStorage; cast to a typed mock view so
// .mockResolvedValue / .mockImplementation are visible to TypeScript.
const mockAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.MockedFunction<(key: string) => Promise<string | null>>;
  setItem: jest.MockedFunction<(key: string, value: string) => Promise<void>>;
  removeItem: jest.MockedFunction<(key: string) => Promise<void>>;
  getAllKeys: jest.MockedFunction<() => Promise<readonly string[]>>;
  multiRemove: jest.MockedFunction<(keys: readonly string[]) => Promise<void>>;
};

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
    // F3a defaults: cache miss (don't short-circuit) + write resolves silently.
    isExhaustedMock.mockResolvedValue(false);
    markExhaustedMock.mockResolvedValue(undefined);
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
    // B2: PUBLIC scope threads categoryKey only; categoryId must NOT be
    // forwarded (public categories carry no server UUID post-bundling).
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({
      categoryKey: 'city',
      language: 'fr',
    }));
    const fetchArgs = fetchMock.mock.calls[0][0] as { categoryId?: unknown };
    expect(fetchArgs.categoryId).toBeUndefined();
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

  it('Tier 4 (looping replay) fetches "all" from HEAD with no category_id, regardless of original category (Tier 4 category bug)', async () => {
    // Phase 2 review: Tier 4 must override the original category with
    // { key: 'all' } so fetchCardBatch sends NO category_id (server returns
    // 'all' cards) and appendCardBatch writes to the 'all' namespace. Passing
    // the original category (e.g. sports) leaks sports cards into both the
    // server query and the 'all' write.
    //
    // Setup: original category is sports (id=5). Make Tier 1, 2, 3 all fail
    // (local resolver returns null at every tier, foreground fetch returns
    // empty), then Tier 4 succeeds — assert its fetchCardBatch call has NO
    // categoryId (undefined), NOT categoryId=5.
    resolveMock
      .mockResolvedValueOnce(null as never)   // Tier 1 local
      .mockResolvedValueOnce(null as never)   // Tier 2 recheck (post-prefetch)
      .mockResolvedValueOnce(null as never)   // Tier 3 cross-fallback (warmed 'all')
      .mockResolvedValueOnce(A_CARD_RESULT as never); // after Tier 4 fetch+append
    // Tier 2 foreground fetch: empty.
    fetchMock.mockResolvedValueOnce({ isError: false, images: [] } as never);
    // Tier 4 foreground fetch: replay set.
    fetchMock.mockResolvedValueOnce({ isError: false, images: [{ listId: 1 }] } as never);

    const sportsArgs = { ...BASE_ARGS, category: { key: 'sports', id: 5 } };

    const result = await resolveNextCardWithServerFallback(sportsArgs);

    // Tier 4 fetch is the 2nd fetchCardBatch call.
    const tier4FetchCall = fetchMock.mock.calls[1][0] as { categoryKey?: string; categoryId?: number; pictureIdOverride?: string | null };
    expect(tier4FetchCall.categoryKey).toBe('all');
    expect(tier4FetchCall.pictureIdOverride).toBeNull();
    expect(tier4FetchCall.categoryId).toBeUndefined();
    // Tier 4 append writes to the 'all' namespace (no categoryId).
    const tier4AppendCall = appendMock.mock.calls[appendMock.mock.calls.length - 1][0] as { categoryKey?: string; categoryId?: number };
    expect(tier4AppendCall.categoryKey).toBe('all');
    expect(tier4AppendCall.categoryId).toBeUndefined();
    expect(result.next).toEqual(A_CARD_RESULT);
    expect(result.reason).toBe('ok');
  });

  // ─── RC10/T4.3 — same-card repeat (user bug) ─────────────────────────────
  //
  // Real-writer end-to-end: with the mocks that bypass appendCardBatch and
  // resolveNextGuessParams lifted, the advancer must NOT return the just-played
  // card when the server re-serves it in the Tier 2 batch. The fix lives in
  // appendCardBatch / updateImageList (drop duplicates by pictureId); this test
  // exercises that fix through the public advancer flow with a real AsyncStorage
  // deck so the regression is observable at the advancer boundary.

  describe('resolveNextCardWithServerFallback — same-card repeat (RC10 user bug)', () => {
    const realStorage = jest.requireActual('../utils/storageDatum');
    const realCardDeck = jest.requireActual('../services/cardDeck');
    const realHandleGuess = jest.requireActual('../utils/handleGuessOutcome');

    beforeEach(() => {
      // Lift the writer/resolver mocks for this suite only. Real appendCardBatch
      // + real resolveNextGuessParams + real normalizeListIds exercise the
      // pictureId dedup end-to-end against AsyncStorage.
      appendMock.mockImplementation(realCardDeck.appendCardBatch as never);
      resolveMock.mockImplementation(realHandleGuess.resolveNextGuessParams as never);
      normalizeMock.mockImplementation(realStorage.normalizeListIds as never);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
    });

    it('does NOT return the just-played card when the server re-serves it in Tier 2', async () => {
      // AsyncStorage as an in-memory store so writes (appendCardBatch →
      // updateImageList) are visible to subsequent reads (resolver). The deck
      // starts with the just-played card; currentListId=1 → Tier 1 finds no
      // listId > 1 → null → Tier 2 fires.
      const store = new Map<string, string>();
      store.set(
        'imageList:city:fr',
        JSON.stringify([{ listId: 1, pictureId: 'played-card', imageFile: 'file:///cache/played.jpg' }]),
      );
      mockAsyncStorage.getItem.mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null));
      mockAsyncStorage.setItem.mockImplementation((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      });

      // Server re-serves the just-played card + a new card. Without pictureId
      // dedup, appendCardBatch would give 'played-card' a fresh listId > 1 and
      // the resolver would return it → same card repeats.
      fetchMock.mockResolvedValue({
        isError: false,
        images: [
          { pictureId: 'played-card' },
          { pictureId: 'new-card' },
        ],
      } as never);

      const result = await resolveNextCardWithServerFallback({
        ...BASE_ARGS,
        currentListId: 1,
      });

      expect(result.reason).toBe('ok');
      expect(result.next).not.toBeNull();
      expect((result.next as { params: { pictureId?: string } }).params.pictureId).toBe('new-card');
    });
  });

  // ─── Fix 1 — exhausted-marker invalidation pin ───────────────────────────
  //
  // The marker write sites (cardPrefetcher markCategoryExhausted on empty
  // prefetch, foregroundTopUp on empty Tier-2 fetch) are paired with a CLEAR
  // in appendCardBatch/persistCardBatch whenever a non-empty batch lands.
  // Wire the REAL appendCardBatch behind the mocked cardDeck export so the
  // Tier-2 → append chain exercises the clear end-to-end.

  it('Fix 1 pin: Tier-2 successful fetch (non-empty) clears the exhausted marker', async () => {
    appendMock.mockImplementation(jest.requireActual('../services/cardDeck').appendCardBatch as never);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    resolveMock
      .mockResolvedValueOnce(null as never)            // Tier 1 local empty
      .mockResolvedValueOnce(null as never)            // Tier 2 recheck (prefetch no-op)
      .mockResolvedValueOnce(A_CARD_RESULT as never);  // after Tier 2 fetch + append
    fetchMock.mockResolvedValue({ isError: false, images: [{ listId: 9, pictureId: 'fresh-1' }] } as never);

    const result = await resolveNextCardWithServerFallback(BASE_ARGS);

    expect(result.reason).toBe('ok');
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(clearExhaustedMock).toHaveBeenCalledWith('city', 'fr', BASE_ARGS.scope);
  });

  // ─── F3a — exhausted-category cache (Tier 2 short-circuit) ──────────────
  //
  // When the server returned 0 cards for a (categoryKey, language, scope)
  // tuple on a prior advance, the tuple is cached as exhausted. Subsequent
  // advances short-circuit at Tier 2 → straight to Tier 3 ('all' cross-
  // fallback) with zero server round-trips. Guards: never cache 'all'; never
  // read/write on the Tier-4 head-replay path; only the genuine-empty branch
  // writes (5xx MUST NOT poison).
  describe('resolveNextCardWithServerFallback — F3a exhausted-category cache', () => {
    it('(a) isCategoryExhausted=false → foregroundTopUp fetches normally (no short-circuit)', async () => {
      resolveMock
        .mockResolvedValueOnce(null as never)   // Tier 1
        .mockResolvedValueOnce(null as never)   // Tier 2 recheck
        .mockResolvedValueOnce(A_CARD_RESULT as never);
      fetchMock.mockResolvedValue({ isError: false, images: [{ listId: 9 }] } as never);
      isExhaustedMock.mockResolvedValue(false);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.reason).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: 'city' }));
    });

    it('(b) isCategoryExhausted=true + non-null override + non-"all" → returns {ok:false,reason:"empty"} WITHOUT fetchCardBatch; Tier 3 still runs', async () => {
      resolveMock
        .mockResolvedValueOnce(null as never)   // Tier 1
        .mockResolvedValueOnce(A_CARD_RESULT as never); // Tier 3 warmed 'all' hits
      isExhaustedMock.mockResolvedValue(true);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.reason).toBe('ok');
      // The city fetch was short-circuited — no fetchCardBatch for the category.
      expect(fetchMock).not.toHaveBeenCalled();
      // Read happened for the city tuple (Tier 2 path, pictureIdOverride=undefined).
      expect(isExhaustedMock).toHaveBeenCalledWith('city', 'fr', BASE_ARGS.scope);
      // Control reached Tier 3 (cache short-circuit does NOT bypass T3).
      expect(warmMock).toHaveBeenCalledTimes(1);
    });

    it('(c) server returns empty + non-null override + non-"all" → markCategoryExhausted called for the tuple', async () => {
      resolveMock
        .mockResolvedValueOnce(null as never)   // Tier 1
        .mockResolvedValueOnce(null as never)   // Tier 2 recheck (still empty)
        .mockResolvedValueOnce(A_CARD_RESULT as never); // Tier 3 warmed 'all'
      fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

      await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(markExhaustedMock).toHaveBeenCalledWith('city', 'fr', BASE_ARGS.scope);
    });

    it('(d) categoryKey === "all" → NEVER writes cache even on empty', async () => {
      resolveMock.mockResolvedValue(null as never);
      fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

      await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    it('(e) Tier 4 (pictureIdOverride=null) → NEVER reads AND NEVER writes the cache', async () => {
      // category='all' end-to-end so the only non-trivial tier is Tier 4
      // (head replay with pictureIdOverride=null). Both Tier 2 and Tier 4 have
      // categoryKey='all' AND Tier 4 has isHeadReplay=true, so cache is never
      // consulted.
      resolveMock.mockResolvedValue(null as never);
      fetchMock.mockResolvedValue({ isError: false, images: [] } as never);

      await resolveNextCardWithServerFallback({ ...BASE_ARGS, category: { key: 'all' } });

      expect(isExhaustedMock).not.toHaveBeenCalled();
      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    it('(h) cache-hit at Tier 2 → control still reaches Tier 3 ("all" cross-fallback runs)', async () => {
      // Tier 2 short-circuits with reason='empty' (cache hit). The cascade
      // pushes the reason and continues to Tier 3 — the cache hit must NOT
      // bypass T3. Tier 3 warms 'all' and resolves a card.
      resolveMock
        .mockResolvedValueOnce(null as never)   // Tier 1
        .mockResolvedValueOnce(A_CARD_RESULT as never); // Tier 3 warmed 'all'
      isExhaustedMock.mockResolvedValue(true);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.reason).toBe('ok');
      expect(warmMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('(j) CC4 defensive pin: 5xx (r.isError=true → reason="server") does NOT write the exhausted cache', async () => {
      // Only the genuine-empty branch writes. A 5xx blip must not poison the
      // cache — otherwise a transient server error permanently marks a
      // category exhausted.
      resolveMock
        .mockResolvedValueOnce(null as never)   // Tier 1
        .mockResolvedValueOnce(null as never)   // Tier 2 recheck
        .mockResolvedValueOnce(A_CARD_RESULT as never); // Tier 3 warmed 'all'
      fetchMock.mockResolvedValue({ isError: true } as never);

      await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    // ─── H1 — getImages reason forwarding + exhaustion-cache safety ─────────
    //
    // getImages now returns { isError: true, reason: 'network' } on total
    // download-side network failure. fetchCardBatch passes the result through
    // unmodified, so the advancer must forward the reason instead of lumping
    // every isError into 'server'. Both Tier 2 (category fetch) and Tier 4
    // ('all' head replay) fetch — every fetch fails in these tests.

    it('H1: network-class failure on every fetch → reason "network", exhausted cache never written', async () => {
      resolveMock.mockResolvedValue(null as never);
      fetchMock.mockResolvedValue({ isError: true, reason: 'network' } as never);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.next).toBeNull();
      expect(result.reason).toBe('network');
      // Tier 2 (city) + Tier 4 (all head replay) both fetched and failed.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(appendMock).not.toHaveBeenCalled();
      // Network failure must NOT poison the exhaustion cache (isError results
      // return before the genuine-empty write branch).
      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    it('H1: server-class failure (no reason) on every fetch → reason "server", exhausted cache never written', async () => {
      resolveMock.mockResolvedValue(null as never);
      fetchMock.mockResolvedValue({ isError: true } as never);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.next).toBeNull();
      expect(result.reason).toBe('server');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    it('H1: network on Tier 2 + genuine empty on Tier 4 → reason "empty" (priority empty > network)', async () => {
      resolveMock.mockResolvedValue(null as never);
      // Tier 2 (city, cursor): network-class failure. Tier 4 ('all', head):
      // genuine empty — categoryKey 'all' also skips the cache write.
      fetchMock
        .mockResolvedValueOnce({ isError: true, reason: 'network' } as never)
        .mockResolvedValueOnce({ isError: false, images: [] } as never);

      const result = await resolveNextCardWithServerFallback(BASE_ARGS);

      expect(result.next).toBeNull();
      expect(result.reason).toBe('empty');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(markExhaustedMock).not.toHaveBeenCalled();
    });

    describe('private scope isolation + purge (real AsyncStorage)', () => {
      const realStorage = jest.requireActual('../utils/storageDatum');
      const realGroupFeedCache = jest.requireActual('../services/groups/groupFeedCache');

      // In-memory AsyncStorage so the real helpers' writes are observable
      // across groups without leaking between tests.
      let store: Map<string, string>;
      const memoryAsyncStorage = () => ({
        getItem: (key: string) => Promise.resolve(store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => { store.set(key, value); return Promise.resolve(); },
        removeItem: (key: string) => { store.delete(key); return Promise.resolve(); },
        getAllKeys: () => Promise.resolve(Array.from(store.keys())),
        multiRemove: (keys: string[]) => { for (const k of keys) store.delete(k); return Promise.resolve(); },
      });

      beforeEach(() => {
        store = new Map();
        const mem = memoryAsyncStorage();
        mockAsyncStorage.getItem.mockImplementation(mem.getItem as never);
        mockAsyncStorage.setItem.mockImplementation(mem.setItem as never);
        mockAsyncStorage.removeItem.mockImplementation(mem.removeItem as never);
        mockAsyncStorage.getAllKeys.mockImplementation(mem.getAllKeys as never);
        mockAsyncStorage.multiRemove.mockImplementation(mem.multiRemove as never);
      });

      it('(g) group A marking category exhausted does NOT mark it for group B (distinct groupFeedCache keys)', async () => {
        await realStorage.markCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' });

        expect(await realStorage.isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(true);
        // Group B reads the same (categoryKey, language) but its own groupId — MUST be false.
        expect(await realStorage.isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupB' })).toBe(false);

        // Keys are groupId-scoped (no cross-contamination).
        const keys = await AsyncStorage.getAllKeys();
        expect(keys).toContain('groupFeedExhausted:groupA:city:fr');
        expect(keys).not.toContain('groupFeedExhausted:groupB:city:fr');
      });

      it('(i) purgeAllPrivateCaches drops the private exhausted marker', async () => {
        await realStorage.markCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' });
        expect(await realStorage.isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(true);

        await realGroupFeedCache.purgeAllPrivateCaches();

        expect(await realStorage.isCategoryExhausted('city', 'fr', { kind: 'private', groupId: 'groupA' })).toBe(false);
        const keys = await AsyncStorage.getAllKeys();
        expect(keys).not.toContain('groupFeedExhausted:groupA:city:fr');
      });
    });
  });
});
