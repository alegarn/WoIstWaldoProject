import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import {  StyleSheet, Text, View, Alert, Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import BadgeDetailModal from './BadgeDetailModal';
import ButtonDefault from './Button';
import SwipeableCardDefault from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';
import useBadgeDetailDefault from './useBadgeDetail';

import { getE2EHiddenGuessCard, getLastImageUuid, getLocalImages, isCategoryExhausted, normalizeListIds, removeImageFromList, deleteImageFromStorage, saveLastImageUuid, PUBLIC_FEED_END_CURSOR } from '../../utils/storageDatum';
import { addPlayedPictureId, filterPlayedCards, getPlayedPictureIds } from '../../utils/playedPictureIds';
import { logFeedEvent } from '../../utils/feedDiagnostics';
import { isCycleExhausted, startNewServingCycle } from '../../utils/servingCycle';
import { isAllPoolDrainedFresh, markAllPoolDrained } from '../../utils/allPoolDrained';
import { AuthContext } from '../../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../../utils/e2eMode';
import { GlobalStyle } from '../../constants/theme';
import { readGroupFeedCache } from '../../services/groups/groupFeedCache';
import { PRIVATE_FEED_END_CURSOR } from '../../services/groups/groupFeedApi';
import { fetchCardBatch, persistCardBatch, appendCardBatch, probeAllPoolForUnplayed, removeCardFromGroupDeck } from '../../services/cardDeck';
import type { CardImage } from '../../services/cardDeck';
import type { GroupScope } from '../../types/groups';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { RECENT_ALL_CATEGORY } from '../../constants/categories';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

// Feed-error payloads come from non-React transports (utils/imagesRequests.js,
// services/groups/groupFeedApi.js) as English title/message strings. Mapping
// them here to i18n keys keeps the transports untouched; unknown strings fall
// back to themselves via t(raw, { defaultValue: raw }).
const FEED_ERROR_KEYS: Record<string, string> = {
  "There is an error downloading user's images.": 'guess.feedErrors.downloadTitle',
  'There is an authentication error.': 'guess.feedErrors.authTitle',
  'Failed to load private images.': 'guess.feedErrors.privateTitle',
  'Please retry later...': 'guess.feedErrors.downloadMessage',
  'Please reconnect': 'guess.feedErrors.reconnectMessage',
};

type SwipeCategory = {
  key?: string | null;
  id?: string | null;
};

type SwipeCard = CardImage & {
  name?: string;
};

type FeedLoadResult = boolean | 'error' | void;

type BadgeDetailState = {
  detailImage: SwipeCard | null;
  detailTags: Array<{ name?: string }> | undefined;
  detailRating: number | undefined;
  detailVisible: boolean;
  openDetail: (item: SwipeCard) => void;
  closeDetail: () => void;
};

type ButtonProps = {
  children?: ReactNode;
  mode?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

type SwipeableCardProps = {
  item: SwipeCard;
  removeCard: (id: number) => Promise<null>;
  screenWidth: number;
  screenHeight: number;
  onSwipe: (args: { item: SwipeCard }) => void;
  onBadgePress: (item: SwipeCard) => void;
};

// Button.js/SwipeableCard.js are .js deps whose destructured (default-less)
// props TS infers as all-required; cast to the optional-prop shapes this
// component actually passes — behavior preserved.
const Button = ButtonDefault as unknown as FC<ButtonProps>;
const SwipeableCard = SwipeableCardDefault as unknown as FC<SwipeableCardProps>;

export interface SwipeImageProps {
  screenWidth: number;
  screenHeight: number;
  startGuessing: (args: { item: SwipeCard }) => void;
  category?: SwipeCategory | null;
  language?: string | null;
  mode?: string | null;
  onOpenFilter: () => void;
  onOpenModeFilter: () => void;
  scope?: GroupScope | null;
}

export default function SwipeImage({ screenWidth, screenHeight, startGuessing, category, language, mode, onOpenFilter, onOpenModeFilter, scope }: SwipeImageProps) {
  const { t } = useTranslation();

  const translateFeedErrorText = (raw?: string) => t(FEED_ERROR_KEYS[raw ?? ''] ?? raw, { defaultValue: raw });

  const categoryKey = category?.key || 'all';
  const lang = language || 'any';
  const filterMode = mode || 'any';
  const privateGroupId = scope?.kind === 'private' ? scope.groupId : null;
  const isPrivateScope = !!privateGroupId;
  // Scope-correct feed-end sentinel: the mount sentinel arm writes the PRIVATE
  // sentinel under a private scope, so every degradation gate must compare the
  // SAME sentinel — a public-only comparison never fires under private scope.
  const feedEndSentinel = isPrivateScope ? PRIVATE_FEED_END_CURSOR : PUBLIC_FEED_END_CURSOR;

  const [imageList, setImageList] = useState<SwipeCard[] | null>(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState<'error' | 'exhausted' | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState(categoryKey);
  const [activeCategory, setActiveCategory] = useState<SwipeCategory | null>(category ?? null);

  const context = useContext(AuthContext);
  const { detailImage, detailTags, detailRating, detailVisible, openDetail, closeDetail } = useBadgeDetailDefault(context) as BadgeDetailState;

  const imageListRef = useRef<SwipeCard[] | null>(null);
  imageListRef.current = imageList;

  const asyncImagesAreLoadingRef = useRef(false);
  asyncImagesAreLoadingRef.current = asyncImagesAreLoading;

  // Commit 1 L2 queue-then-flush: feed-error Alerts from loadNewImages are
  // QUEUED here instead of firing inline (the Alert site is shared by cursor
  // rounds, refill loads, and the head probe). Only the post-probe
  // exhaustion gate drops a queued alert; EVERY non-degrading exit flushes
  // it, so an un-proven error's alert can never be silently lost.
  const pendingProbeAlertRef = useRef<{ title: string; message: string } | null>(null);

  const flushPendingAlert = useCallback(() => {
    const pending = pendingProbeAlertRef.current;
    pendingProbeAlertRef.current = null;
    if (pending) {
      Alert.alert(pending.title, pending.message);
    }
  }, []);

  const activeCategoryKeyRef = useRef(categoryKey);
  activeCategoryKeyRef.current = activeCategoryKey;
  const activeCategoryRef = useRef(category);
  activeCategoryRef.current = activeCategory;

  // G5: the private/public deck-read ternary (group feed cache vs local deck
  // storage) has ONE authoritative form. `readDeckRaw` returns the stored list
  // as-is (null when unset); `readActiveDeck` adds normalizeListIds. Callers
  // apply filterPlayedCards themselves — the exhaustion-count proofs need the
  // UNfiltered deck length beside the servable count.
  const readDeckRaw = useCallback(async (deckKey: string, deckCategory?: SwipeCategory | null): Promise<CardImage[] | null> => (
    isPrivateScope
      ? ((await readGroupFeedCache(privateGroupId, {
        categoryId: deckCategory?.id === 'all' ? undefined : deckCategory?.id,
        language: lang,
        mode: filterMode,
      }))?.images ?? null) as CardImage[] | null
      : await getLocalImages(deckKey, lang, filterMode)
  ), [filterMode, isPrivateScope, lang, privateGroupId]);

  const readActiveDeck = useCallback(async (deckKey: string, deckCategory?: SwipeCategory | null) => normalizeListIds(
    await readDeckRaw(deckKey, deckCategory) ?? [],
  ), [readDeckRaw]);

  // Functions __________________________________________________________________

  /*
   * Handles the data received and updates the image list.
   *
   * @param {Array} data - The data to be handled.
   * @return {Promise<boolean>} A promise that resolves to true if the updated image list has elements, false otherwise.
   */
  const handleData = useCallback(async (data?: CardImage[] | null): Promise<boolean | void> => {
    console.log("handleData");

    const aKey = activeCategoryKeyRef.current;
    const aCat = activeCategoryRef.current;
    const currentImageList = imageListRef.current;

    if (currentImageList === null) {
      console.log("updatedImageList handleData imageList null");
      // Task 6a(i): an empty batch must NOT reach persistCardBatch — persisting
      // `cards: []` wipes the persisted resume deck (I5 violation). Leave the
      // stored deck untouched and report a dry round.
      if (!data || data?.length === 0) {
        setImageList([]);
        return false;
      }
      const normalized = await persistCardBatch({
        cards: data,
        categoryKey: aKey,
        categoryId: aCat?.id,
        language: lang,
        mode: filterMode,
        scope,
      });
      // Repeals predecessor plan D3 exemption ("UI replay feature"): the
      // persisted deck stays COMPLETE (resume truth, I5), but the mount serve
      // honors once-per-cycle (I1) — only unplayed cards reach the stack.
      const filtered = await filterPlayedCards(normalized, lang, scope);
      setImageList(filtered);

      return filtered?.length > 0;
    };

    if (currentImageList !== null) {
      if (data !== null && data !== undefined && data.length > 0) {
        console.log("updatedImageList handleData imageList !== null");
        const merged = await appendCardBatch({
          cards: data,
          categoryKey: aKey,
          categoryId: aCat?.id,
          language: lang,
          mode: filterMode,
          scope,
        });
        // Resurrection-race reconciliation (Fix 3 §2.3.4): removeCard runs
        // OUTSIDE appendCardBatch's scope lock, so an in-flight append RMW that
        // read the deck BEFORE a removal can return a merged deck still
        // containing the just-swiped card. Removals win: keep only cards whose
        // pictureId is still in memory or in the incoming batch — pictureId-less
        // legacy cards are unidentifiable and pass through.
        const allowed = new Set([...(currentImageList ?? []), ...(data ?? [])].map((c) => c?.pictureId).filter(Boolean));
        const reconciled = merged.filter((c) => !c?.pictureId || allowed.has(c.pictureId));
        setImageList(reconciled);
        return reconciled?.length > 0;
      }

      return false;
    };
  }, [filterMode, lang, scope]);

  /**
   * Fetch+append path: call `fetchCardBatch` with the active category/language/
   * scope, then hand the response to `handleData`. Translates the fetch outcome
   * into the same result contract as `handleImagesLoading`.
   * @param {string|null|undefined} [pictureIdOverride] - When provided, sent as
   *   the server cursor; `undefined` → caller-side persisted cursor, `null` →
   *   fresh head query.
   * @returns {Promise<boolean|'error'|void>} `true`/`false` from handleData,
   *   `'error'` when the fetch errored (alert already shown).
   */
  const loadNewImages = useCallback(async (pictureIdOverride?: string | null): Promise<FeedLoadResult> => {
    console.log("loadNewImages");
    const response = await fetchCardBatch({
      categoryKey: activeCategoryKeyRef.current,
      categoryId: activeCategoryRef.current?.id,
      language,
      mode: filterMode,
      scope,
      authContext: context,
      pictureIdOverride,
    });

    if (response.isError === true) {
      // Commit 1 L2, Alert gate at the emission site (pinned): an error over
      // an ARMED feed-end sentinel is decidable PRE-probe — the alert is
      // dropped here, before the probe's degradation gate runs. Any other
      // error alert is QUEUED pending that gate (see pendingProbeAlertRef).
      // The read is guarded (.catch → null) so a rejecting cursor read fails
      // open (the alert stays honest, no unhandled rejection).
      const sentinelArmed = (await getLastImageUuid(
        activeCategoryKeyRef.current,
        language,
        scope,
        filterMode,
      ).catch(() => null)) === feedEndSentinel;
      if (!sentinelArmed) {
        pendingProbeAlertRef.current = {
          title: translateFeedErrorText(response.title),
          message: translateFeedErrorText(response.message),
        };
      }
      return 'error';
    };
    if (response.isError === false) {
      //console.log("response.images", response.isError);
      const isCardLeft = await handleData(response.images);
      return isCardLeft;
    };
  }, [context, feedEndSentinel, filterMode, handleData, language, scope]);

  /**
   * Centralized image-loading entry. Drives the `asyncImagesAreLoading` and
   * `noMoreCard` flags around `loadNewImages`, and RETURNS its result so the
   * caller can branch on the fetch outcome.
   *
   * `pictureIdOverride`:
   * - `undefined` (omitted) → `loadNewImages` reads the persisted feed cursor.
   * - `null` → fresh head query (no cursor).
   *
   * Result semantics:
   * - truthy / `true` → cards arrived; `noMoreCard` cleared.
   * - `false` → server returned an empty batch; `noMoreCard` set to 'exhausted'.
   * - `'error'` → fetch failed; alert already shown, `noMoreCard` set to 'error'.
   *
   * @param {string|null|undefined} [pictureIdOverride] - Cursor override; see above.
   * @returns {Promise<boolean|'error'|void>} The `loadNewImages` result.
   */
  /* centralized function for loading images / set when imgs are loading */
  const handleImagesLoading = useCallback(async (pictureIdOverride?: string | null): Promise<FeedLoadResult> => {
    console.log("handleImagesLoading");

    setAsyncImagesAreLoading(true);
    try {
      const result = await loadNewImages(pictureIdOverride);
      if (result === 'error') {
        setNoMoreCard('error');
      } else if (result === false) {
        setNoMoreCard('exhausted');
      } else if (result === true) {
        setNoMoreCard(null);
      }
      return result;
    } catch (error) {
      // Commit 1 L3: a rejection (storage or transport) must never pin the
      // loading overlay or escape the mount chain as an unhandled rejection.
      // Route by the same sentinel/end-proof rule as the probe-error arms
      // (proven → 'exhausted'; else honest 'error'); every proof read is
      // individually guarded — this path already had one storage failure.
      console.warn('handleImagesLoading failed', error);
      let feedEndProven = false;
      try {
        feedEndProven = (await getLastImageUuid(
          activeCategoryKeyRef.current,
          language,
          scope,
          filterMode,
        )) === feedEndSentinel;
      } catch {
        feedEndProven = false;
      }
      if (!feedEndProven) {
        try {
          const headDeck = await readActiveDeck(activeCategoryKeyRef.current, activeCategoryRef.current);
          const servableCount = (await filterPlayedCards(headDeck, lang, scope)).length;
          feedEndProven = isCycleExhausted(headDeck.length, servableCount);
        } catch {
          feedEndProven = false;
        }
      }
      setNoMoreCard(feedEndProven ? 'exhausted' : 'error');
      setImageList([]);
      return 'error';
    } finally {
      setAsyncImagesAreLoading(false);
    }
  }, [feedEndSentinel, filterMode, lang, language, loadNewImages, readActiveDeck, scope]);

  /**
   * Shared mount recovery tail (I4/I7), run by ALL THREE deck branches of
   * `handleGetImagesList` once their cursor round came back without servable
   * cards. After the branch's cursor round:
   * - `'error'` → restore the non-null empty serve state so the error/retry
   *   panel renders (an errored round never ran `handleData`; a null list
   *   would pin the loading overlay forever). No probe, no cycle mutation.
   * - `false` → ONE fresh `handleImagesLoading(null)` head probe. When
   *   `resetServeStateForHead` is set (empty/full-deck branches) the serve
   *   state is reset first so the head batch takes the FULL-persist path
   *   (resume truth, I5) — the cycle-recovery re-read below needs the landed
   *   batch on disk; the partial-deck branch keeps Fix 2a's append path.
   *   Probe also `false` → write the SCOPE-CORRECT exhausted sentinel
   *   (public: `PUBLIC_FEED_END_CURSOR`, private: `PRIVATE_FEED_END_CURSOR`).
   * - Probe `'error'` → same non-null empty restore, recovery gated off (I7).
   * - Cycle recovery (I4), gated on a probe that did NOT error: the
   *   CATEGORY-side proof is the deck head non-empty but every card already
   *   played this cycle (`isCycleExhausted`) — that alone is NOT exhaustion
   *   (Bug 2: re-entering a finished category used to wipe the SHARED
   *   played-set on every mount). The sound 'all'-pool proof comes from
   *   `probeAllPoolForUnplayed`:
   *   - `'unplayed'` → the 'all' pool still serves unplayed cards: serve the
   *     'all' deck and switch the active category to 'all' (same mechanism as
   *     refillOrFallback step 3). NO transition.
   *   - `'exhausted'` → 'all' pool server-drained — BOTH pools proven
   *     exhausted → at most ONE `startNewServingCycle` transition per mount
   *     clears the played-set and re-serves the deck head oldest-first.
   *   - `'indeterminate'` → transient failure: NO transition, the exhausted
   *     flow stands (I7).
   *   The three deck branches are mutually exclusive and each invokes this
   *   helper at most once per mount, so no extra transition guard is needed.
   *   A genuinely empty deck (server empty) is NOT exhaustion — the exhausted
   *   flow stands, no transition.
   *
   * @param {boolean|'error'|void} cursorResult - The branch's cursor-round result.
   * @param {{resetServeStateForHead: boolean}} opts - Whether the head probe
   *   may reset the serve state (empty/full-deck) or must append (partial).
   * @returns {Promise<void>}
   */
  const runMountRecoveryFlow = useCallback(async (cursorResult: FeedLoadResult, { resetServeStateForHead }: { resetServeStateForHead: boolean }): Promise<void> => {
    console.log("runMountRecoveryFlow");

    if (cursorResult === 'error') {
      // Restore the non-null empty serve state so the error panel can render
      // (a null list would pin the loading overlay forever). Only the
      // null-serve branches (empty / filtered-empty full deck) need it — the
      // partial branch already holds a non-null serve. No probe, no cycle
      // mutation.
      // Commit 1 L2: the identical sentinel-armed check — an error over an
      // ARMED feed-end sentinel is never honest, so degrade to exhaustion
      // and drop the queued Alert (this arm performs no deck reads; one
      // explicit cursor read arbitrates). Un-proven errors flush the queued
      // Alert at this exit — the error stays honest.
      if ((await getLastImageUuid(categoryKey, lang, scope, filterMode).catch(() => null)) === feedEndSentinel) {
        pendingProbeAlertRef.current = null;
        logFeedEvent('probe-error-degraded', { stage: 'cursor-round', gate: 'sentinel-armed', categoryKey });
        setNoMoreCard('exhausted');
        setImageList([]);
        return;
      }
      if (resetServeStateForHead) {
        setImageList([]);
      }
      flushPendingAlert();
      return;
    }
    if (cursorResult !== false) {
      return;
    }

    if (resetServeStateForHead) {
      imageListRef.current = null;
      setImageList(null);
    }
    const headResult = await handleImagesLoading(null);

    // Commit 1 L2 hoist (pinned placement): the deck/played reads run AFTER
    // the probe resolves and BEFORE the 'error' check below — never above
    // the probe call (a pre-probe snapshot would be stale and, on the
    // probe-success path, spuriously trigger the cycle restart = release-user
    // auto-replay + played-set wipe). Same O(deck) sweep, zero added work on
    // the success path; the reads now also serve the error-path gate.
    // Commit 2 guard (same pattern as the handleImagesLoading catch path): a
    // storage rejection here must neither escape the mount chain as an
    // unhandled rejection nor strand the probe's queued Alert. On rejection
    // the proof stays un-proven (an empty deck never satisfies
    // isCycleExhausted), so the cycle-exhausted degrade checks below skip to
    // the honest error path; the sentinel gate keeps arbitrating on its own
    // guarded read. No flush here: the 'error' gate below drops or flushes
    // the queued Alert (queue-then-flush invariant — every queue→exit path is
    // gated), and a flush before that gate would pre-empt its drop (the
    // fail-open-emission + concurrent-arm race).
    let headDeck: CardImage[] = [];
    let servableCount = 0;
    try {
      headDeck = await readActiveDeck(categoryKey, category);
      servableCount = (await filterPlayedCards(headDeck, lang, scope)).length;
    } catch (error) {
      console.warn('runMountRecoveryFlow deck reads failed', error);
    }

    if (headResult === 'error') {
      // Commit 1 L2 probe-error degradation: an error over an ARMED sentinel
      // or a fully-played deck is never honest — degrade to the exhaustion
      // panel and DROP the queued Alert. Un-proven errors flush it at the
      // non-degrading exit (error panel + Alert stay honest).
      const sentinelArmed = (await getLastImageUuid(categoryKey, lang, scope, filterMode).catch(() => null)) === feedEndSentinel;
      if (sentinelArmed || isCycleExhausted(headDeck.length, servableCount)) {
        pendingProbeAlertRef.current = null;
        logFeedEvent('probe-error-degraded', {
          stage: 'head-probe',
          gate: sentinelArmed ? 'sentinel-armed' : 'cycle-exhausted',
          categoryKey,
        });
        setNoMoreCard('exhausted');
        setImageList([]);
        return;
      }
      // Restore the non-null empty serve state so the error panel can
      // render (a null list would pin the loading overlay forever).
      if (resetServeStateForHead) {
        setImageList([]);
      }
      flushPendingAlert();
      return;
    }
    if (headResult === false) {
      // Commit 3 O2: the mount sentinel arm is sound only when the empty head
      // result is explained by local play evidence. The 'all' pool NEVER arms
      // here — it owns the epoch-stamped allPoolDrained proof (mirrors the
      // 'all' exclusions in nextCardAdvancer/cardPrefetcher) — and a category
      // scope arms only over a non-empty played set (an empty played set
      // means the emptiness cannot be exclusion-driven). The played-set read
      // lives on the head-probe-false path only; a failing read fail-opens to
      // "no evidence" and skips the arm.
      const playedIds = categoryKey === 'all'
        ? []
        : await getPlayedPictureIds(lang, scope).catch(() => []);
      if (playedIds.length > 0) {
        await saveLastImageUuid(
          feedEndSentinel,
          categoryKey,
          lang,
          scope,
          filterMode,
        ).catch(() => {});
        logFeedEvent('mount-sentinel-arm', { categoryKey, language: lang });
      }
    }

    if (isCycleExhausted(headDeck.length, servableCount)) {
      // D4/A6 (Task 5c): consult-before-network — a drained-and-fresh stamp
      // (carrying the epoch the previous restart re-stamped, 4b) already
      // proves the 'all' pool drained for this cycle: skip the ≤20-batch
      // probe and run the SAME startNewServingCycle branch below. A missing/
      // stale-epoch stamp is never fresh → the sound probe arbitrates.
      const probe = (await isAllPoolDrainedFresh(lang, scope))
        ? { status: 'exhausted' }
        : await probeAllPoolForUnplayed({
          language: lang,
          mode: filterMode,
          scope,
          authContext: context,
          excludePictureId: imageListRef.current?.[0]?.pictureId,
        });
      if (probe?.status === 'unplayed') {
        // Serve the 'all' deck (the probe appended ≥1 unplayed card to it)
        // and switch the active category the same way refillOrFallback
        // step 3 does, so win-removal namespaces stay consistent.
        const allDeck = await filterPlayedCards(
          await readActiveDeck('all', RECENT_ALL_CATEGORY),
          lang,
          scope,
        );
        if (allDeck.length > 0) {
          setActiveCategoryKey('all');
          setActiveCategory(RECENT_ALL_CATEGORY);
          setImageList(allDeck);
        }
      } else if (probe?.status === 'exhausted') {
        // Task 4b (D3): post-restart re-stamp — re-stamp ONLY with the epoch
        // this restart returned (undefined on restart failure → skip; the
        // stale orphan is inert, epoch mismatch invalidates it).
        const newEpoch = await startNewServingCycle(lang, scope).catch(() => {});
        if (typeof newEpoch === 'number') {
          await markAllPoolDrained(lang, scope, newEpoch).catch(() => {});
        }
        setImageList(await filterPlayedCards(headDeck, lang, scope));
      }
      // 'indeterminate' → NO transition (I7); the exhausted flow stands.
    }
  }, [category, categoryKey, context, feedEndSentinel, filterMode, flushPendingAlert, handleImagesLoading, lang, readActiveDeck, scope]);

  /**
   * Mount loader. Reads the local deck for the active (category, language) and
   * branches by deck size (e2e mode short-circuits to a fixture/saved card);
   * every non-e2e branch funnels into `runMountRecoveryFlow` when its filtered
   * serve comes back empty:
   * - cold (null / length 0) → cursor-based `handleImagesLoading()` FIRST (I5
   *   resume), then the shared recovery tail.
   * - full (length ≥ 4) → serve the played-filtered local deck directly; when
   *   the filter empties it (every stored card played — the common
   *   'recent/all' exhaustion entry), run the SAME recovery tail instead of
   *   dead-ending on the exhausted panel.
   * - partial (1–3) → played-filtered serve + cursor-based top-up, then the
   *   shared recovery tail (head probe keeps Fix 2a's append path).
   *
   * @returns {Promise<void>}
   */
  const handleGetImagesList = useCallback(async () => {
    console.log("handleGetImagesList");

    if (isE2EMode()) {
      setNoMoreCard(null);
      const savedGuessPayload = await getE2EHiddenGuessCard();
      const savedGuessCard = buildE2EGuessCardFromPayload(savedGuessPayload as Record<string, unknown>);

      if (savedGuessCard) {
        setImageList([savedGuessCard] as unknown as SwipeCard[]);
        return;
      }

      setImageList(buildE2EGuessCards() as unknown as SwipeCard[]);
      return;
    }

    //await emptyImageList(categoryKey, lang);
    // Raw deck read (no normalize): the size branches below (>=4 / 0 / 1-3)
    // classify the STORED deck, before any played filtering.
    const localImageList = await readDeckRaw(categoryKey, category);

    // if localImageList [] or null, get Images() / show loadingOverlay
    if (localImageList !== null && (localImageList?.length >= 4)) {
      // Review MINOR #1: if every stored card is already in the played-set the
      // filtered deck is EMPTY — serving it would render a blank stack with no
      // fetch and no noMoreCard signal. Run the shared mount recovery tail
      // instead (cursor round → head probe → sentinel → at most ONE cycle
      // transition, I4).
      const filtered = await filterPlayedCards(normalizeListIds(localImageList), lang, scope);
      if (filtered.length > 0) {
        setImageList(filtered);
      } else {
        await runMountRecoveryFlow(await handleImagesLoading(), { resetServeStateForHead: true });
      }
    } else if (localImageList === null || localImageList?.length === 0) {
      // Empty category deck on mount (I5): cursor-mode FIRST — the persisted
      // keyset cursor resumes the feed after the last served card. Only an
      // exhausted cursor round falls back to a fresh head query (new uploads
      // surface), mirroring the partial-deck branch below — including the
      // scope-correct sentinel write when both rounds come back empty.
      // Cross-fallback to 'recent/all' belongs to mid-play (refillOrFallback).
      const cursorResult = await handleImagesLoading();
      await runMountRecoveryFlow(cursorResult, { resetServeStateForHead: true });
    } else {
      setImageList(await filterPlayedCards(normalizeListIds(localImageList), lang, scope));
      const cursorResult = await handleImagesLoading();
      // Fix 2a: no serve-state reset before the head probe — the partial deck
      // keeps the append path (stored REAL cursor intact, no rewind). The
      // shared recovery tail still applies (I4).
      await runMountRecoveryFlow(cursorResult, { resetServeStateForHead: false });
    };
  }, [category, categoryKey, context, handleImagesLoading, language, lang, readDeckRaw, runMountRecoveryFlow, scope]);


  const deleteImage = useCallback(async (id: number, imageFilePath: string | null | undefined) => {
    // delete image
    if (!isPrivateScope) {
      await removeImageFromList(id, activeCategoryKeyRef.current, lang, filterMode);
    }
    await deleteImageFromStorage(imageFilePath);
    return null;
  }, [filterMode, isPrivateScope, lang]);

  /*
   * Deck-empty fallback. Prefers background-prefetched cards (re-read the active
   * deck — the prefetcher may have appended to AsyncStorage since mount), then
   * the warmed 'all' deck (awaiting any in-flight warm), then a foreground load
   * as a last resort. Avoids the "Load new images..." overlay whenever the
   * background prefetcher has done its job.
   */
  const refillOrFallback = useCallback(async (categoryPrefetchPromise: Promise<void>) => {
    const aKey = activeCategoryKeyRef.current;
    const aCat = activeCategoryRef.current;

    const readDeck = async (deckKey: string, deckCategory?: SwipeCategory | null) => filterPlayedCards(
      await readActiveDeck(deckKey, deckCategory),
      lang,
      scope,
    );

    // 1. Re-read the active deck — the background prefetcher may have appended
    //    cards to AsyncStorage that local state hasn't picked up yet.
    let catDeck = await readDeck(aKey, aCat);
    if (catDeck.length > 0) {
      setImageList(catDeck);
      return;
    }

    // D4/A6 (Task 5d): consult the all-pool drained stamp where the re-arm
    // attempts initiate — drained-and-fresh → skip step 2's prefetchIfLow
    // re-arm AND step 3's warmAllDeckIfNeeded fetch (ONLY those), then fall
    // through to step 4 and the final gated load. D4 precedence pin: the
    // consult NEVER skips straight to the exhausted UI — the final load (and
    // its Task 6b single head fallback) still runs, so a cap-200-resurrected
    // id behind the cursor keeps its serve path.
    const allPoolDrainedFresh = await isAllPoolDrainedFresh(language, scope).catch(() => false);

    // 2. Join any in-flight category prefetch (or start one at deck 0) before
    //    declaring the category exhausted. This covers the last-card race where
    //    the background top-up lands just after the first storage read.
    // SwipeImage intentionally operates cursor-agnostic; pass undefined so
    // getRemainingDeckCount counts all remaining cards.
    if (!allPoolDrainedFresh) {
      await (categoryPrefetchPromise ?? prefetchIfLow({
        categoryKey: aKey,
        categoryId: aCat?.id,
        language,
        mode: filterMode,
        scope,
        authContext: context,
        currentListId: undefined,
      }).catch(() => {}));
    }

    catDeck = await readDeck(aKey, aCat);
    if (catDeck.length > 0) {
      setImageList(catDeck);
      return;
    }

    // 3. Active deck empty and not already on 'all' → fall back to the 'all' deck.
    //    Await the warm so we don't bounce when the warm is mid-flight.
    if (aKey !== 'all') {
      if (!allPoolDrainedFresh) {
        await warmAllDeckIfNeeded({ language, mode: filterMode, scope, authContext: context }).catch(() => {});
      }
      const allDeck = await readDeck('all', RECENT_ALL_CATEGORY);
      if (allDeck.length > 0) {
        setActiveCategoryKey('all');
        setActiveCategory(RECENT_ALL_CATEGORY);
        setImageList(allDeck);
        return;
      }
    }

    // 4. Both empty — last-resort foreground load (will show the overlay, but
    //    only when truly out of cards). Keep on the active category/scope.
    if (aKey !== 'all') {
      const exhausted = await isCategoryExhausted(aKey, language, scope, filterMode).catch(() => false);
      if (exhausted) {
        setNoMoreCard('exhausted');
        return;
      }
    }
    const lastLoad = await handleImagesLoading();
    // Task 6b: a dry cursor round gets ONE head fallback before accepting
    // 'exhausted' (mirrors runMountRecoveryFlow's cursor-round + head-probe
    // contract) — this re-serves the trim-to-zero row (getLocalImages dead-file
    // trim) and any cursor-past survivor, including under a fresh all-pool
    // stamp (D4 precedence pin: the 5d consult skips re-arm fetches ONLY;
    // this fallback runs ONCE per refill attempt regardless of stamp
    // freshness). Bound: one head attempt per refill call — no loop.
    if (lastLoad === false) {
      await handleImagesLoading(null);
    }
    // Commit 1 L2: every non-degrading exit flushes a queued alert — the
    // refill owns the alerts of its two final loads (cursor round + head
    // fallback); only a recovery-flow degradation may drop one.
    flushPendingAlert();
  }, [context, filterMode, flushPendingAlert, handleImagesLoading, lang, language, readActiveDeck, scope]);

  /*
   * Asynchronously removes a card from the image list based on the provided id.
   *
   * @param {string} id - The id of the card to be removed.
   * @return {null}
   */
  const removeCard = useCallback(
    async (id: number) => {
      const currentList = imageListRef.current ?? [];
      const updatedImageList = currentList.filter((item) => item.listId !== id);
      const image = currentList.find((item) => item.listId === id);
      const aCat = activeCategoryRef.current;

      if (image?.pictureId) {
        addPlayedPictureId(image.pictureId, lang, scope).catch(() => {});
      }

      if (image?.imageFile) {
        await deleteImage(id, image.imageFile);
      }
      // Synchronous ref sync (beyond the render-phase assignment at the top):
      // closes the stale-ref window where an in-flight handleData
      // reconciliation — building its allowed-pictureId set from this ref
      // before the re-render commits — would resurrect the just-removed card.
      imageListRef.current = updatedImageList;
      setImageList(updatedImageList);
      if (isPrivateScope) {
        await removeCardFromGroupDeck({
          groupId: privateGroupId,
          categoryId: aCat?.id === 'all' ? undefined : aCat?.id,
          language: lang,
          mode: filterMode,
          listId: id,
        });
      }

      // SwipeImage intentionally operates cursor-agnostic; pass undefined so
      // getRemainingDeckCount counts all remaining cards.
      const prefetchPromise = prefetchIfLow({
        categoryKey: activeCategoryKeyRef.current,
        categoryId: aCat?.id,
        language,
        mode: filterMode,
        scope,
        authContext: context,
        currentListId: undefined,
      }).catch(() => {});

      // Deck-empty fallback: prefer background-prefetched cards, then 'all' deck,
      // then a foreground load as last resort. Avoids the "Load new images..."
      // blocking overlay whenever the background prefetcher has done its job.
      if (updatedImageList?.length === 0 && !asyncImagesAreLoadingRef.current) {
        await refillOrFallback(prefetchPromise);
      }

      return null;
    },
    [context, deleteImage, filterMode, isPrivateScope, lang, language, privateGroupId, refillOrFallback, scope]
  );

  // Effects __________________________________________________________________
  useLayoutEffect(() => {
    // Intentional: initial load on mount only.
    handleGetImagesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Components functions ________________________________________________________
  // Commit 2 tester gate: EXPO_PUBLIC_TESTER_TOOLS is set ONLY in the eas.json
  // `preview` (internal APK) profile — production never sets it, so this reads
  // as dead code there. Inline (not a module const) so it stays a per-build
  // literal with no expo-constants dependency.
  const testerToolsEnabled = process.env.EXPO_PUBLIC_TESTER_TOOLS === 'true';

  // One press → one startNewServingCycle (epoch bump + played-set wipe +
  // sentinel/marker/stamp clear; AsyncStorage-only, no network) + ONE fresh
  // head fetch so the oldest cards re-serve immediately. Deck wipe is
  // deliberately NOT part of this (wipePublicGuessStorage would nuke decks).
  const confirmRestartServingCycle = useCallback(() => {
    Alert.alert(
      t('guess.emptyRestartConfirmTitle'),
      t('guess.emptyRestartConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            await startNewServingCycle(lang, scope).catch(() => {});
            await handleImagesLoading(null).catch(() => {});
            // Commit 1 L2 queue-then-flush: this load is the replay flow's
            // LAST exit — no recovery gate runs after it, so a failed load
            // would strand its queued Alert unless flushed here.
            flushPendingAlert();
          },
        },
      ],
    );
  }, [flushPendingAlert, handleImagesLoading, lang, scope, t]);

  const showIsLoading = () => {
    return <LoadingOverlay message={t('guess.loading')} />
  };

  const showNoMoreCard = () => {
    return(
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateText}>{t('guess.emptyErrorTitle')}</Text>
        <View style={styles.emptyStateActions}>
          <Text style={styles.emptyStateText}>{t('guess.emptyPlayHint')}</Text>
          <Text style={styles.emptyStateText}>{t('guess.emptyUploadHint')}</Text>
          <Text style={styles.emptyStateText}>{t('guess.emptyWaitUploadHint')}</Text>
        </View>
      </View>
    );
  };

  const showNoMoreImages = () => {
    return(
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateText}>{t('guess.emptyExhaustedTitle')}</Text>
        <View style={styles.emptyStateActions}>
          <Text style={styles.emptyStateText}>{t('guess.emptyPlayHint')}</Text>
          <Text style={styles.emptyStateText}>{t('guess.emptyUploadHint')}</Text>
          <Text style={styles.emptyStateText}>{t('guess.emptyWaitUploadsHint')}</Text>
        </View>
        {testerToolsEnabled && (
          <Button
            mode="flat"
            style={styles.emptyStateRestartButton}
            testID="guess.empty.restart-cycle"
            accessibilityLabel={t('guess.emptyRestartAction')}
            onPress={confirmRestartServingCycle}
          >
            {t('guess.emptyRestartAction')}
          </Button>
        )}
      </View>
    );
  };


  const reversedImageList = useMemo(() => {
    if (!imageList) return [];
    return [...imageList].reverse();
  }, [imageList]);

  const modalImage = useMemo(() => {
    if (!detailImage) {
      return null;
    }

    if (detailTags === undefined) {
      return detailImage;
    }

    const merged: SwipeCard = {
      ...detailImage,
      tags: detailTags.map((tag) => tag?.name ?? tag),
    };

    if (detailRating !== undefined) {
      merged.ratings = detailRating;
    }

    return merged;
  }, [detailImage, detailTags, detailRating]);

  return (
    <SafeAreaView style={styles.screen} testID="guess-path.swipe-stack" edges={Platform.OS === 'ios' ? ['top', 'bottom'] : []}>
      {(imageList === null) || (imageList !== null && imageList?.length === 0 && asyncImagesAreLoading) ? (
        showIsLoading()
      ) : (noMoreCard === 'error') && (imageList?.length === 0) && (!asyncImagesAreLoading) ? (
        showNoMoreCard()
      ) : (noMoreCard === 'exhausted') && (imageList?.length === 0) && (!asyncImagesAreLoading) ? (
        showNoMoreImages()
      ) : (
        <>
          {/* <Text style={styles.titleText}>Double Tap or Swipe</Text> */}
          <GestureHandlerRootView style={styles.container}>
            {(imageList?.length === 0) && (asyncImagesAreLoading) ?
              showIsLoading() :
              ((imageList.length === 0 && noMoreCard === 'error' && !asyncImagesAreLoading) ?
                showNoMoreCard() :
              (imageList.length === 0 && noMoreCard === 'exhausted' && !asyncImagesAreLoading) ?
                showNoMoreImages() :
              (
                <>
                  {reversedImageList.map((item) => (
                    <SwipeableCard
                      key={item.listId ?? item.name}
                      item={item}
                      onBadgePress={openDetail}
                      removeCard={removeCard}
                      screenWidth={screenWidth}
                      screenHeight={screenHeight}
                      onSwipe={startGuessing}
                    />
                  ))}
                </>
              )
            )
            }
          </GestureHandlerRootView>
          {detailVisible && modalImage ? (
            <BadgeDetailModal
              image={modalImage}
              onClose={closeDetail}
              onOpenFilter={onOpenFilter}
              onOpenModeFilter={onOpenModeFilter}
              testIDPrefix="guess-path.detail"
            />
          ) : null}
        </>
        )
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor900,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateActions: {
    paddingTop: 10,
  },
  emptyStateRestartButton: {
    marginTop: 16,
    minWidth: 220,
  },
  emptyStateText: {
    color: GlobalStyle.color.quaternaryColor,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});






