import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView/* , GestureDetector, Gesture */ } from 'react-native-gesture-handler';

import BadgeDetailModal from './BadgeDetailModal';
import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';
import useBadgeDetail from './useBadgeDetail';

import { getImages } from '../../utils/imagesRequests';
import { getE2EHiddenGuessCard, getLocalImages, storeImageList, getLastImageId, emptyImageList, removeImageFromList, updateImageList, getLastImageUuid, saveLastImageUuid, deleteImageFromStorage } from '../../utils/storageDatum';
import { AuthContext } from '../../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../../utils/e2eMode';
import { GlobalStyle } from '../../constants/theme';
import { readGroupFeedCache, writeGroupFeedCache } from '../../services/groups/groupFeedCache';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, screenHeight, startGuessing, category, language, onOpenFilter, scope }) {

  const categoryKey = category?.key || 'all';
  const lang = language || 'any';
  const privateGroupId = scope?.kind === 'private' ? scope.groupId : null;
  const isPrivateScope = !!privateGroupId;

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(null);

  const context = useContext(AuthContext);
  const { detailImage, detailTags, detailRating, detailVisible, openDetail, closeDetail } = useBadgeDetail(context);

  const imageListRef = useRef(null);
  imageListRef.current = imageList;

  const asyncImagesAreLoadingRef = useRef(false);
  asyncImagesAreLoadingRef.current = asyncImagesAreLoading;

  // Functions __________________________________________________________________

  /*
   * Handles the data received and updates the image list.
   *
   * @param {Array} data - The data to be handled.
   * @return {Promise<boolean>} A promise that resolves to true if the updated image list has elements, false otherwise.
   */
  const handleData = useCallback(async (data) => {
    console.log("handleData");

    const currentImageList = imageListRef.current;
    const lastId = currentImageList?.length
      ? currentImageList.reduce((maxId, image) => Math.max(maxId, image?.listId ?? 0), 0)
      : await getLastImageId(categoryKey, lang);
    // This is done to add a unique identifier to each object in 'data', which will be used to keep track of the order in which images are displayed.
    const updatedImageList = data?.map((image, index) => ({
     ...image,
     listId: lastId + 1 + index,
    }));

    if (currentImageList === null) {
      console.log("updatedImageList handleData imageList null");
      if (isPrivateScope) {
        await writeGroupFeedCache(
          privateGroupId,
          { categoryId: category?.id === 'all' ? undefined : category?.id, language: lang },
          { images: updatedImageList, nextCursor: null },
        );
      } else {
        await storeImageList(updatedImageList, categoryKey, lang);
      }
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
        const newImageList = isPrivateScope
          ? [...currentImageList, ...updatedImageList]
          : await updateImageList(updatedImageList, categoryKey, lang);
        if (isPrivateScope) {
          await writeGroupFeedCache(
            privateGroupId,
            { categoryId: category?.id === 'all' ? undefined : category?.id, language: lang },
            { images: newImageList, nextCursor: null },
          );
        }
        setImageList(newImageList);
        return true
      };

      return false
    };
  }, [category?.id, categoryKey, isPrivateScope, lang, privateGroupId]);

  const loadNewImages = useCallback(async (pictureIdOverride) => {
    console.log("loadNewImages");
    const lastImageUuid = await getLastImageUuid(categoryKey, lang);
    const pictureId = pictureIdOverride !== undefined ? pictureIdOverride : lastImageUuid;
    const response = await getImages(pictureId, context, {
      category_id: category?.id === 'all' ? undefined : category?.id,
      category_key: category?.key || 'all',
      language,
      scope,
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
  }, [context, handleData, category, language, categoryKey, lang]);

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
      await handleImagesLoading(null);
    } else {
      setImageList(localImageList);
      await handleImagesLoading();
    };
  }, [category?.id, categoryKey, handleImagesLoading, isPrivateScope, lang, privateGroupId]);


  const deleteImage = useCallback(async (id, imageFilePath) => {
    // delete image
    if (!isPrivateScope) {
      await removeImageFromList(id, categoryKey, lang);
    }
    await deleteImageFromStorage(imageFilePath);
    return null;
  }, [categoryKey, isPrivateScope, lang]);

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

      if (image?.imageFile) {
        await deleteImage(id, image.imageFile);
      }
      setImageList(updatedImageList);
      if (isPrivateScope) {
        await writeGroupFeedCache(
          privateGroupId,
          { categoryId: category?.id === 'all' ? undefined : category?.id, language: lang },
          { images: updatedImageList, nextCursor: null },
        );
      }

      if (updatedImageList?.length < 4 && !asyncImagesAreLoadingRef.current) {
        await handleImagesLoading();
      }
      return null;
    },
    [category?.id, deleteImage, handleImagesLoading, isPrivateScope, lang, privateGroupId]
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






