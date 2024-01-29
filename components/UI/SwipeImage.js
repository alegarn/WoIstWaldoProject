import { useEffect, useLayoutEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/imagesRequests';
import { getLocalImages, storeImageList, getLastImageId, emptyImageList, removeImageFromList, updateImageList, getLastImageUuid, saveLastImageUuid } from '../../utils/storageDatum';

import * as FileSystem from 'expo-file-system';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, screenHeight, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState('--');


  const handleData = async (data) => {
    console.log("handleData");

    const lastId = await getLastImageId();
    const updatedImageList = data?.map((image, index) => ({
      ...image,
      listId: lastId + index,
    }));

    if (imageList === null) {
      console.log("updatedImageList handleData imageList null");
      await storeImageList(updatedImageList);
      setImageList(updatedImageList);

      if (updatedImageList?.length > 0) {
        return true
      };

      if (updatedImageList?.length === 0) {
        return false
      };
    };

    if (imageList !== null) {
      console.log("updatedImageList handleData imageList !== null");

      if (updatedImageList?.length > 0) {
        const newImageList = await updateImageList(updatedImageList);
        setImageList(newImageList);
        return true
      };

      return false
    };
  };

  async function loadNewImages() {
    console.log("loadNewImages");
    const lastImageUuid = await getLastImageUuid();
    const response = await getImages(lastImageUuid);

    if (response.isError === true) {
      Alert.alert(response.title, response.message);
    };
    if (response.isError === false) {
      console.log("response.images", response.isError);
      const isCardLeft = await handleData(response.images);
      return isCardLeft
    };
  };

  /* centralized function for loading images / set when imgs are loading */
  const handleImagesLoading = async () => {
    console.log("handleImagesLoading");

    setAsyncImagesAreLoading(true);
    const isCardLeft = await loadNewImages();
    isCardLeft ? null : setNoMoreCard(true);
    await saveLastImageUuid();
    setAsyncImagesAreLoading(false);
  };


  const handleGetImagesList = async () => {
    console.log("handleGetImagesList");

    //await emptyImageList();
    const localImageList = await getLocalImages();

    // if localImageList [] or null, get Images() / show loadingOverlay
    if (localImageList !== null && (localImageList?.length >= 4)) {
      setImageList(localImageList);
      return null;
    };

    await handleImagesLoading();
  };




  const removeCard = async (id) => {
    const updatedImageList = imageList.filter((item) => item.listId !== id);
    const image = imageList.filter((item) => item.listId === id)[0];

    // delete image
    await removeImageFromList(id);
    await FileSystem.deleteAsync(image.imageFile, { idempotent: true });
    const fileName = image.imageFile.substring(image.imageFile.lastIndexOf("/") + 1);
    const imagePickerUrl = FileSystem.cacheDirectory + `ImagePicker/${fileName}`;
    [imagePickerUrl, image.imageFile].map(async (item) => {
      console.log("removeCard item", item);
      await FileSystem.deleteAsync(item, { idempotent: true });
    });

    setImageList(updatedImageList);

    if ((updatedImageList?.length < 4) && (!asyncImagesAreLoading)) {
      await handleImagesLoading();
    };
  };

  const lastSwipedDirection = (swipeDirection) => {
    // nop left / later right ?
    setSwipeDirection(swipeDirection);
  };

/* put double-tap ? */
/*   const gesture = Gesture.Tap()
  .numberOfTaps(2)
  .onStart(() => {

*/
/* fait bugger le bouton? */
/*   const gesture = Gesture.LongPress()
  .onEnd(() => {
    const item = imageList.slice(-1)[0];
    startGuessing({item});
  });
 */
  useLayoutEffect(() => {
    if (!asyncImagesAreLoading) {
      handleGetImagesList();
    };
  }, []);

  const showIsLoading = () => {
    const message='Loading new images...';
    return <LoadingOverlay message={message} />
  };

  const showNoMoreCard = () => {
    return(
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>The list is not there, there is a problem... No new images? :O</Text>
        <View style={{ paddingTop: 10 }}>
          <Text>To play you can:</Text>
          <Text> - Upload new images</Text>
          <Text> - Wait until someone else upload new images</Text>
        </View>
      </View>
    );
  };


  const GestureCard = ({ item/* , gesture */ }) => {
    return(
      /* <GestureDetector  gesture={gesture} > */
    
        <SwipeableCard
          item={item}
          removeCard={() => removeCard(item.listId)}
          swipedDirection={lastSwipedDirection}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          onSwipe={startGuessing}
        />
   
      /* </GestureDetector> */
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {(imageList === null) || (imageList !== null && imageList?.length === 0 && asyncImagesAreLoading) ? (
        showIsLoading()
      ) : ((noMoreCard === true) && (imageList?.length === 0) && (!asyncImagesAreLoading)) ? (
        showNoMoreCard()
      ) : (
        <>
          {/* <Text style={styles.titleText}>Double Tap or Swipe</Text> */}
          <GestureHandlerRootView style={styles.container}>
            {(imageList?.length === 0) && (asyncImagesAreLoading) ?
              showIsLoading() :
              ((imageList.length === 0 && noMoreCard && !asyncImagesAreLoading) ?
                showNoMoreCard()
                  :
                (
                  <>
                    {imageList?.map((item, id) => (
                      <GestureCard item={item} /* gesture={gesture} */ key={id}/>
                    ))}
                  </>
                )
              )
            }
          </GestureHandlerRootView>
        </>
        )
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});






