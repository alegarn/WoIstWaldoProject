import { useEffect, useLayoutEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/imagesRequests';
import { getLocalImages, storeImageList, getLastImageId, emptyImageList, removeImageFromList, updateImageList, getLastImageUuid, saveLastImageUuid } from '../../utils/storageDatum';

import * as FileSystem from 'expo-file-system';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState('--');


  const handleData = async (data) => {
    console.log("handleData");

    const lastId = await getLastImageId();
    const updatedImageList = data?.map((image, index) => ({
      ...image,
      listId: lastId + index + 1,
    }));

    if (imageList === null) {
      console.log("updatedImageList handleData imageList null");
      await storeImageList(updatedImageList);
      setImageList(updatedImageList);
    };

    if (imageList !== null) {
      console.log("updatedImageList handleData imageList !== null");
      const newImageList = await updateImageList(updatedImageList);
      setImageList(newImageList);
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
      await handleData(response.images);
      setNoMoreCard(false);
    };
  };



  const handleGetImagesList = async () => {
    console.log("handleGetImagesList");

    //emptyImageList();
    const localImageList = await getLocalImages();

    // if localImageList [] or null, get Images() / show loadingOverlay
    if (localImageList !== null) {

      //swiping
      if ((localImageList?.length < 4) && (!asyncImagesAreLoading)) {
        await handleNewImagesLoading();
      };

      // swiping after 0 images (got internet problems)
      if ((localImageList?.length === 0) && (!asyncImagesAreLoading) && (imageList !== null)) {
        await handleNewImagesLoading();
      };

      // lauching / swiping and no more cards
      if ((localImageList?.length === 0) && (!asyncImagesAreLoading) && (imageList?.length === 0)) {
        const cardsLeft = await handleNewImagesLoading();
        if (cardsLeft === false) {
          return showNoMoreCard();
        };
      };
    };

    // get images on first launching after 0 images
    if ((localImageList === null) && (!asyncImagesAreLoading) || ((localImageList?.length === 0) && (!asyncImagesAreLoading) && (imageList === null))) {
      console.log("localImageList === null");
      const response = await getImages(null);

      if (response.isError === true) {
        Alert.alert(response.title, response.message);
      };

      if (response.isError === false) {
        console.log("response.isError", response.isError);
        await handleData(response.images);
        await saveLastImageUuid();
        setNoMoreCard(false);
      };
    };

    if (((localImageList !== null) || (localImageList?.length >= 4) && (!asyncImagesAreLoading))) {
      setImageList(localImageList);
      setNoMoreCard(false);
    };

  };




  const removeCard = async (id) => {
    const updatedImageList = imageList.filter((item) => item.listId !== id);
    const image = imageList.filter((item) => item.listId === id)[0];
    // delete image
    await removeImageFromList(id);
    await FileSystem.deleteAsync(image.imageFile, { idempotent: true });
    setImageList(updatedImageList);

    console.log("updatedImageList removeCard", updatedImageList);

    if ((updatedImageList.length < 4) && (!asyncImagesAreLoading)) {
      await handleNewImagesLoading();
      if (updateImageList.length === 0) {
        setNoMoreCard(true);
      };
    };
  };

  const lastSwipedDirection = (swipeDirection) => {
    // nop left / later right ?
    setSwipeDirection(swipeDirection);
  };


  const gesture = Gesture.LongPress()
    .onEnd(() => {
    const item = imageList.slice(-1)[0];
    startGuessing({item});
  });

  const handleNewImagesLoading = async () => {
    console.log("handleNewImagesLoading");
    console.log("asyncImagesAreLoading", asyncImagesAreLoading);
    console.log("imageList", imageList);
    if ((!asyncImagesAreLoading) && (imageList !== null) && (imageList?.length < 4)) {
      const localImageList = await getLocalImages();
      await loadNewImages(localImageList);
      await saveLastImageUuid();
      setAsyncImagesAreLoading(false);
      setNoMoreCard(false);
      return true
    };
/*  if ((!asyncImagesAreLoading) && (imageList == null)) {
      const localImageList = await getLocalImages();

} */
    return false;
  };

  useLayoutEffect(() => {
    handleGetImagesList();
  }, []);

  useEffect(() => {
    if (!asyncImagesAreLoading) {
      handleNewImagesLoading();
    };
  }, [asyncImagesAreLoading])

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


  const GestureCard = ({item, gesture }) => {
    return(
      <GestureDetector gesture={gesture}>
        <SwipeableCard
          item={item}
          removeCard={() => removeCard(item.listId)}
          swipedDirection={lastSwipedDirection}
          screenWidth={screenWidth}
          onPress={startGuessing}
        />
      </GestureDetector>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {(imageList === null) ? (
        showIsLoading()
      ) : ((imageList !== null) && (imageList?.length === 0)) ? (
        showNoMoreCard()
      ) : (
        <>
          <Text style={styles.titleText}>Press Longely to Play or Swipe</Text>
          <GestureHandlerRootView style={styles.container}>
            {noMoreCard ?
              showIsLoading() :
              (<>
                {imageList?.map((item, id) => (
                  <GestureCard item={item} gesture={gesture} key={id}/>
                ))}
              </>)
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






