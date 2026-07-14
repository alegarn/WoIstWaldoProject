import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView/* , GestureDetector, Gesture */ } from 'react-native-gesture-handler';

import BadgeDetailModal from './BadgeDetailModal';
import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';
import useBadgeDetail from './useBadgeDetail';

import { getE2EHiddenGuessCard, getLocalImages, getLastImageId, removeImageFromList, deleteImageFromStorage } from '../../utils/storageDatum';
import { AuthContext } from '../../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../../utils/e2eMode';
import { GlobalStyle } from '../../constants/theme';
import { readGroupFeedCache, writeGroupFeedCache } from '../../services/groups/groupFeedCache';
import { fetchCardBatch, persistCardBatch, appendCardBatch } from '../../services/cardDeck';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../../services/cardPrefetcher';
import { RECENT_ALL_CATEGORY } from '../../constants/categories';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, screenHeight, startGuessing, category, language, onOpenFilter, scope }) {

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
    const lastId = currentImageList?.length
      ? currentImageList.reduce((maxId, image) => Math.max(maxId, image?.listId ?? 0), 0)
      : await getLastImageId(aKey, lang);
    // This is done to add a unique identifier to each object in 'data', which will be used to keep track of the order in which images are displayed.
    const updatedImageList = data?.map((image, index) => ({
     ...image,
     listId: lastId + 1 + index,
    }));

    if (currentImageList === null) {
      console.log("updatedImageList handleData imageList null");
      await persistCardBatch({
        cards: updatedImageList,
        categoryKey: aKey,
        categoryId: aCat?.id,
        language: lang,
        scope,
      });
      setImageList(updatedImageList);

      if (updatedImageList?.length > 0) {
        return true
      };

      if (updatedImageList?.length === 0) {
        return false
      };
    };

    if (currentImageList !== null) {
      console.log("updatedImageList handleData imageList !== null");

      if (updatedImageList?.length > 0) {
        await appendCardBatch({
          cards: updatedImageList,
          categoryKey: aKey,
          categoryId: aCat?.id,
          language: lang,
          scope,
        });
        const newImageList = [...currentImageList, ...updatedImageList];
        setImageList(newImageList);
        return true;
      }

      return false;
    };
  }, [lang, scope]);

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
      Alert.alert(response.title, response.message);
      return 'error';
    };
    if (response.isError === false) {
      //console.log("response.images", response.isError);
      const isCardLeft = await handleData(response.images);
      return isCardLeft;
    };
  }, [context, handleData, language, scope]);

  /* centralized function for loading images / set when imgs are loading */
  const handleImagesLoading = useCallback(async (pictureIdOverride) => {
    console.log("handleImagesLoading");

    setAsyncImagesAreLoading(true);
    const result = await loadNewImages(pictureIdOverride);
    if (result === 'error') {
      setNoMoreCard('error');
    } else if (result === false) {
      setNoMoreCard('exhausted');
    }
    setAsyncImagesAreLoading(false);
  }, [loadNewImages]);

  /*
  * Handles the retrieval of the list of images.
  *
  * @return {null} Returns null if the localImageList is not null and has a length of at least 4.
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
      setImageList(localImageList);
    } else if (localImageList === null || localImageList?.length === 0) {
      // Category deck empty on mount — try 'all' fallback before blocking foreground load.
      if (categoryKey !== 'all') {
        await warmAllDeckIfNeeded({ language, scope, authContext: context }).catch(() => {});
        const allDeck = isPrivateScope
          ? (await readGroupFeedCache(privateGroupId, { categoryId: undefined, language: lang }))?.images ?? null
          : await getLocalImages('all', lang);
        if (allDeck && allDeck.length > 0) {
          setActiveCategoryKey('all');
          setActiveCategory(RECENT_ALL_CATEGORY);
          setImageList(allDeck);
          return;
        }
      }
      await handleImagesLoading(null);
    } else {
      setImageList(localImageList);
      await handleImagesLoading();
    };
  }, [category?.id, categoryKey, context, handleImagesLoading, isPrivateScope, lang, language, privateGroupId, scope]);


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

    const readDeck = async (deckKey, deckCategory) => (
      isPrivateScope
        ? (await readGroupFeedCache(privateGroupId, { categoryId: deckCategory?.id === 'all' ? undefined : deckCategory?.id, language: lang }))?.images ?? []
        : (await getLocalImages(deckKey, lang)) ?? []
    );

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
    await (categoryPrefetchPromise ?? prefetchIfLow({
      categoryKey: aKey,
      categoryId: aCat?.id,
      language,
      scope,
      authContext: context,
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

      if (image?.imageFile) {
        await deleteImage(id, image.imageFile);
      }
      setImageList(updatedImageList);
      if (isPrivateScope) {
        await writeGroupFeedCache(
          privateGroupId,
          { categoryId: aCat?.id === 'all' ? undefined : aCat?.id, language: lang },
          { images: updatedImageList, nextCursor: null },
        );
      }

      const prefetchPromise = prefetchIfLow({
        categoryKey: activeCategoryKeyRef.current,
        categoryId: aCat?.id,
        language,
        scope,
        authContext: context,
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
    const message='Loading new images...';
    return <LoadingOverlay message={message} />
  };

  const showNoMoreCard = () => {
    return(
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateText}>The list is not there, there is a problem... No new images? :O</Text>
        <View style={styles.emptyStateActions}>
          <Text style={styles.emptyStateText}>To play you can:</Text>
          <Text style={styles.emptyStateText}> - Upload new images</Text>
          <Text style={styles.emptyStateText}> - Wait until someone else upload new images</Text>
        </View>
      </View>
    );
  };

  const showNoMoreImages = () => {
    return(
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateText}>No more images to guess right now!</Text>
        <View style={styles.emptyStateActions}>
          <Text style={styles.emptyStateText}>To play you can:</Text>
          <Text style={styles.emptyStateText}> - Upload new images</Text>
          <Text style={styles.emptyStateText}> - Wait until someone else uploads new images</Text>
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
                      key={item.listId}
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






