import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView/* , GestureDetector, Gesture */ } from 'react-native-gesture-handler';

import BadgeDetailModal from './BadgeDetailModal';
import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';
import useBadgeDetail from './useBadgeDetail';

import { getE2EHiddenGuessCard, getLocalImages, isCategoryExhausted, normalizeListIds, removeImageFromList, deleteImageFromStorage, saveLastImageUuid, PUBLIC_FEED_END_CURSOR } from '../../utils/storageDatum';
import { addPlayedPictureId, filterPlayedCards } from '../../utils/playedPictureIds';
import { isCycleExhausted, startNewServingCycle } from '../../utils/servingCycle';
import { AuthContext } from '../../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../../utils/e2eMode';
import { GlobalStyle } from '../../constants/theme';
import { readGroupFeedCache } from '../../services/groups/groupFeedCache';
import { PRIVATE_FEED_END_CURSOR } from '../../services/groups/groupFeedApi';
import { fetchCardBatch, persistCardBatch, appendCardBatch, probeAllPoolForUnplayed, removeCardFromGroupDeck } from '../../services/cardDeck';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { RECENT_ALL_CATEGORY } from '../../constants/categories';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

// Feed-error payloads come from non-React transports (utils/imagesRequests.js,
// services/groups/groupFeedApi.js) as English title/message strings. Mapping
// them here to i18n keys keeps the transports untouched; unknown strings fall
// back to themselves via t(raw, { defaultValue: raw }).
const FEED_ERROR_KEYS = {
  "There is an error downloading user's images.": 'guess.feedErrors.downloadTitle',
  'There is an authentication error.': 'guess.feedErrors.authTitle',
  'Failed to load private images.': 'guess.feedErrors.privateTitle',
  'Please retry later...': 'guess.feedErrors.downloadMessage',
  'Please reconnect': 'guess.feedErrors.reconnectMessage',
};

export default function SwipeImage({ screenWidth, screenHeight, startGuessing, category, language, onOpenFilter, scope }) {
  const { t } = useTranslation();

  const translateFeedErrorText = (raw) => t(FEED_ERROR_KEYS[raw] ?? raw, { defaultValue: raw });

  const categoryKey = category?.key || 'all';
  const lang = language || 'any';
  const privateGroupId = scope?.kind === 'private' ? scope.groupId : null;
  const isPrivateScope = !!privateGroupId;

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState(categoryKey);
  const [activeCategory, setActiveCategory] = useState(category);

  const context = useContext(AuthContext);
  const { detailImage, detailTags, detailRating, detailVisible, openDetail, closeDetail } = useBadgeDetail(context);

  const imageListRef = useRef(null);
  imageListRef.current = imageList;

  const asyncImagesAreLoadingRef = useRef(false);
  asyncImagesAreLoadingRef.current = asyncImagesAreLoading;

  const activeCategoryKeyRef = useRef(categoryKey);
  activeCategoryKeyRef.current = activeCategoryKey;
  const activeCategoryRef = useRef(category);
  activeCategoryRef.current = activeCategory;

  // Functions __________________________________________________________________

  /*
   * Handles the data received and updates the image list.
   *
   * @param {Array} data - The data to be handled.
   * @return {Promise<boolean>} A promise that resolves to true if the updated image list has elements, false otherwise.
   */
  const handleData = useCallback(async (data) => {
    console.log("handleData");

    const aKey = activeCategoryKeyRef.current;
    const aCat = activeCategoryRef.current;
    const currentImageList = imageListRef.current;

    if (currentImageList === null) {
      console.log("updatedImageList handleData imageList null");
      const normalized = await persistCardBatch({
        cards: data,
        categoryKey: aKey,
        categoryId: aCat?.id,
        language: lang,
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
      if (data?.length > 0) {
        console.log("updatedImageList handleData imageList !== null");
        const merged = await appendCardBatch({
          cards: data,
          categoryKey: aKey,
          categoryId: aCat?.id,
          language: lang,
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
  }, [lang, scope]);

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
  const loadNewImages = useCallback(async (pictureIdOverride) => {
    console.log("loadNewImages");
    const response = await fetchCardBatch({
      categoryKey: activeCategoryKeyRef.current,
      categoryId: activeCategoryRef.current?.id,
      language,
      scope,
      authContext: context,
      pictureIdOverride,
    });

    if (response.isError === true) {
      Alert.alert(translateFeedErrorText(response.title), translateFeedErrorText(response.message));
      return 'error';
    };
    if (response.isError === false) {
      //console.log("response.images", response.isError);
      const isCardLeft = await handleData(response.images);
      return isCardLeft;
    };
  }, [context, handleData, language, scope]);

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
  const handleImagesLoading = useCallback(async (pictureIdOverride) => {
    console.log("handleImagesLoading");

    setAsyncImagesAreLoading(true);
    const result = await loadNewImages(pictureIdOverride);
    if (result === 'error') {
      setNoMoreCard('error');
    } else if (result === false) {
      setNoMoreCard('exhausted');
    } else if (result === true) {
      setNoMoreCard(null);
    }
    setAsyncImagesAreLoading(false);
    return result;
  }, [loadNewImages]);

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
  const runMountRecoveryFlow = useCallback(async (cursorResult, { resetServeStateForHead }) => {
    console.log("runMountRecoveryFlow");

    if (cursorResult === 'error') {
      // Restore the non-null empty serve state so the error panel can render
      // (a null list would pin the loading overlay forever). Only the
      // null-serve branches (empty / filtered-empty full deck) need it — the
      // partial branch already holds a non-null serve.
      if (resetServeStateForHead) {
        setImageList([]);
      }
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
    if (headResult === 'error') {
      // Restore the non-null empty serve state so the error panel can
      // render (a null list would pin the loading overlay forever).
      if (resetServeStateForHead) {
        setImageList([]);
      }
      return;
    }
    if (headResult === false) {
      await saveLastImageUuid(
        isPrivateScope ? PRIVATE_FEED_END_CURSOR : PUBLIC_FEED_END_CURSOR,
        categoryKey,
        lang,
        ...(isPrivateScope ? [scope] : []),
      );
    }

    const headDeck = normalizeListIds(
      isPrivateScope
        ? (await readGroupFeedCache(privateGroupId, { categoryId: category?.id === 'all' ? undefined : category?.id, language: lang }))?.images ?? []
        : await getLocalImages(categoryKey, lang) ?? [],
    );
    const servableCount = (await filterPlayedCards(headDeck, lang, scope)).length;
    if (isCycleExhausted(headDeck.length, servableCount)) {
      const probe = await probeAllPoolForUnplayed({
        language: lang,
        scope,
        authContext: context,
        excludePictureId: imageListRef.current?.[0]?.pictureId,
      });
      if (probe?.status === 'unplayed') {
        // Serve the 'all' deck (the probe appended ≥1 unplayed card to it)
        // and switch the active category the same way refillOrFallback
        // step 3 does, so win-removal namespaces stay consistent.
        const allDeck = await filterPlayedCards(normalizeListIds(
          isPrivateScope
            ? (await readGroupFeedCache(privateGroupId, { categoryId: undefined, language: lang }))?.images ?? []
            : await getLocalImages('all', lang) ?? [],
        ), lang, scope);
        if (allDeck.length > 0) {
          setActiveCategoryKey('all');
          setActiveCategory(RECENT_ALL_CATEGORY);
          setImageList(allDeck);
        }
      } else if (probe?.status === 'exhausted') {
        await startNewServingCycle(lang, scope).catch(() => {});
        setImageList(await filterPlayedCards(headDeck, lang, scope));
      }
      // 'indeterminate' → NO transition (I7); the exhausted flow stands.
    }
  }, [category?.id, categoryKey, context, handleImagesLoading, isPrivateScope, lang, privateGroupId, scope]);

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
      const savedGuessCard = buildE2EGuessCardFromPayload(savedGuessPayload);

      if (savedGuessCard) {
        setImageList([savedGuessCard]);
        return;
      }

      setImageList(buildE2EGuessCards());
      return;
    }

    //await emptyImageList(categoryKey, lang);
    const localImageList = isPrivateScope
      ? (await readGroupFeedCache(privateGroupId, { categoryId: category?.id === 'all' ? undefined : category?.id, language: lang }))?.images ?? null
      : await getLocalImages(categoryKey, lang);

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
  }, [category?.id, categoryKey, context, handleImagesLoading, isPrivateScope, lang, language, privateGroupId, runMountRecoveryFlow, scope]);


  const deleteImage = useCallback(async (id, imageFilePath) => {
    // delete image
    if (!isPrivateScope) {
      await removeImageFromList(id, activeCategoryKeyRef.current, lang);
    }
    await deleteImageFromStorage(imageFilePath);
    return null;
  }, [isPrivateScope, lang]);

  /*
   * Deck-empty fallback. Prefers background-prefetched cards (re-read the active
   * deck — the prefetcher may have appended to AsyncStorage since mount), then
   * the warmed 'all' deck (awaiting any in-flight warm), then a foreground load
   * as a last resort. Avoids the "Load new images..." overlay whenever the
   * background prefetcher has done its job.
   */
  const refillOrFallback = useCallback(async (categoryPrefetchPromise) => {
    const aKey = activeCategoryKeyRef.current;
    const aCat = activeCategoryRef.current;

    const readDeck = async (deckKey, deckCategory) => filterPlayedCards(normalizeListIds(
      isPrivateScope
        ? (await readGroupFeedCache(privateGroupId, { categoryId: deckCategory?.id === 'all' ? undefined : deckCategory?.id, language: lang }))?.images ?? []
        : await getLocalImages(deckKey, lang) ?? [],
    ), lang, scope);

    // 1. Re-read the active deck — the background prefetcher may have appended
    //    cards to AsyncStorage that local state hasn't picked up yet.
    let catDeck = await readDeck(aKey, aCat);
    if (catDeck.length > 0) {
      setImageList(catDeck);
      return;
    }

    // 2. Join any in-flight category prefetch (or start one at deck 0) before
    //    declaring the category exhausted. This covers the last-card race where
    //    the background top-up lands just after the first storage read.
    // SwipeImage intentionally operates cursor-agnostic; pass undefined so
    // getRemainingDeckCount counts all remaining cards.
    await (categoryPrefetchPromise ?? prefetchIfLow({
      categoryKey: aKey,
      categoryId: aCat?.id,
      language,
      scope,
      authContext: context,
      currentListId: undefined,
    }).catch(() => {}));

    catDeck = await readDeck(aKey, aCat);
    if (catDeck.length > 0) {
      setImageList(catDeck);
      return;
    }

    // 3. Active deck empty and not already on 'all' → fall back to the 'all' deck.
    //    Await the warm so we don't bounce when the warm is mid-flight.
    if (aKey !== 'all') {
      await warmAllDeckIfNeeded({ language, scope, authContext: context }).catch(() => {});
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
      const exhausted = await isCategoryExhausted(aKey, language, scope).catch(() => false);
      if (exhausted) {
        setNoMoreCard('exhausted');
        return;
      }
    }
    await handleImagesLoading();
  }, [context, handleImagesLoading, isPrivateScope, lang, language, privateGroupId, scope]);

  /*
   * Asynchronously removes a card from the image list based on the provided id.
   *
   * @param {string} id - The id of the card to be removed.
   * @return {null}
   */
  const removeCard = useCallback(
    async (id) => {
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
          listId: id,
        });
      }

      // SwipeImage intentionally operates cursor-agnostic; pass undefined so
      // getRemainingDeckCount counts all remaining cards.
      const prefetchPromise = prefetchIfLow({
        categoryKey: activeCategoryKeyRef.current,
        categoryId: aCat?.id,
        language,
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
    [context, deleteImage, isPrivateScope, lang, language, privateGroupId, refillOrFallback, scope]
  );

  // Effects __________________________________________________________________
  useLayoutEffect(() => {
    // Intentional: initial load on mount only.
    handleGetImagesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Components functions ________________________________________________________
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

    const merged = {
      ...detailImage,
      tags: detailTags.map((tag) => tag?.name ?? tag),
    };

    if (detailRating !== undefined) {
      merged.ratings = detailRating;
    }

    return merged;
  }, [detailImage, detailTags, detailRating]);

  return (
    <SafeAreaView style={styles.screen} testID="guess-path.swipe-stack">
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






