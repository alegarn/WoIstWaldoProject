import { useEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/requests';
import { getLocalImages, storeImageList, getLastImageId } from '../../utils/storageDatum';

import * as FileSystem from 'expo-file-system';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noMoreCard, setNoMoreCard] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState('--');


  const handleData = async (data) => {
    console.log("handleData");
    const last_id = getLastImageId();
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
    setImageList(localImageList);

    if (localImageList === null) {
      const response = await getImages();
      await handleData(response);
      setIsLoading(false);
      return null;
    };

    if ((localImageList.length < 3) && (localImageList !== null)) {
      const id = imageList.slice(-1).pictureId;
      const response = await getImages(id)
      await handleData(response);
    };
    setIsLoading(false);

  };




  const removeCard = async (id) => {
    // alert(id);
    const updatedImageList = imageList.filter((item) => item.listId !== id);
    const image = imageList.filter((item) => item.listId === id)[0];
    // delete image
    await FileSystem.deleteAsync(image.imageFile, { idempotent: true });
    setImageList(updatedImageList);

    if (imageList.length == 0) {
      setNoMoreCard(true);
    }
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


  useEffect(() => {
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
      {isLoading ? (
        showIsLoading()
      ) : imageList !== null ? (
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






