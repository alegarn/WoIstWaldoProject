import { useEffect, useLayoutEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/requests';
import { getLocalImages, storeImageList, getLastImageId, emptyImageList, updateImageList } from '../../utils/storageDatum';

import * as FileSystem from 'expo-file-system';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noMoreCard, setNoMoreCard] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState('--');


  async function setImageListAsync(localImageList) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        setImageList(localImageList);
        resolve();
      }, 1000);
    });
  };

  async function loadImages(imageList) {
    const id = imageList.slice(-1).pictureId;
    const response = await getImages(id);
    if (response.isError === true) {
      Alert.alert(response.title, response.message);
    };
    if (response.images.length === 0) {
      setNoMoreCard(true);
    };
    if (response.isError === false) {
      await handleData(response.images);
    };
  };

  const handleData = async (data) => {

    console.log("handleData");
    const last_id = await getLastImageId();
    const updatedImageList = data.map((image, index) => ({
      ...image,
      listId: last_id + index + 1,
    }));
    await storeImageList(updatedImageList);
    setImageList(updatedImageList);
  };

  const handleGetImagesList = async () => {
    console.log("handleGetImagesList");

    const localImageList = await getLocalImages();

    if (imageList === null) {
      if (localImageList === null) {
        console.log("localImageList === null");
        const response = await getImages();
        if (response.isError === true) {
          Alert.alert(response.title, response.message);
        };
        if (response.isError === false) {
          await handleData(response);
          setIsLoading(false);
        };
        return null;
      };

      if ((localImageList.length !== null)) {
        console.log("(localImageList.length !== null)");
        await setImageListAsync(localImageList);
      };
    };


    if ((localImageList !== null) && (localImageList.length <= 3) && (imageList !== null)) {
      console.log("(localImageList.length < 3)");
      await loadImages(imageList);
    };
    setIsLoading(false);
  };




  const removeCard = async (id) => {
    // alert(id);
    const updatedImageList = imageList.filter((item) => item.listId !== id);
    const image = imageList.filter((item) => item.listId === id)[0];
    // delete image
    await updateImageList(id);
    await FileSystem.deleteAsync(image.imageFile, { idempotent: true });
    setImageList(updatedImageList);
    console.log("updatedImageList", updatedImageList);

    if ((imageList.length <= 3) && (!isLoading)) {
      setIsLoading(true);
      await loadImages(imageList);
      setIsLoading(false);
    };

    if (imageList.length === 0) {
      setNoMoreCard(true);
    };
  };

  const lastSwipedDirection = (swipeDirection) => {
    // nop left / later right ?
    setSwipeDirection(swipeDirection);
  };


  const gesture = Gesture.Pan()
    .onEnd(() => {
    const item = imageList.slice(-1)[0];
    startGuessing({item});
  });


  useLayoutEffect(() => {
    handleGetImagesList();
  }, []);

  const showIsLoading = () => {
    const message='Loading new images...';
    return <LoadingOverlay message={message} />
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
      {(isLoading && imageList === null) || (imageList.length === 0) ? (
        showIsLoading()
      ) : (imageList !== null) ? (
        <>
          <Text style={styles.titleText}>Zoom to Play or Swipe</Text>
          <GestureHandlerRootView style={styles.container}>
            {imageList.map((item, id) => (
              <GestureCard item={item} gesture={gesture} key={id}/>
            ))}
            {noMoreCard ? showIsLoading() : null}
          </GestureHandlerRootView>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>The list is not there, there is a problem... No new images? :O</Text>
        </View>
      )}
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






