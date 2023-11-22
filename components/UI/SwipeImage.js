import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/imagesRequests';
import { getLocalImages, storeImageList, getLastImageId, emptyImageList, removeImageFromList, updateImageList, getLastImageUuid, saveLastImageUuid } from '../../utils/storageDatum';

import * as FileSystem from 'expo-file-system';
import { AuthContext } from '../../store/auth-context';
import { errorLog } from '../../utils/errorLog';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState('--');

  const context = useContext(AuthContext);


  async function setImageListAsync(localImageList) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        setImageList(localImageList);
        resolve();
      }, 1000);
    });
  };


  const handleData = async (data) => {
    console.log("handleData");

    const lastId = await getLastImageId(context);
    const updatedImageList = data?.map((image, index) => ({
      ...image,
      listId: lastId + index + 1,
    }));

    if (imageList === null) {
      console.log("updatedImageList handleData imageList null");
      await storeImageList(updatedImageList, context);
      setImageList(updatedImageList);
    };

    if (imageList !== null) {
      console.log("updatedImageList handleData imageList !== null");
      const newImageList = await updateImageList(updatedImageList, context);
      setImageList(newImageList);
    };
  };

  const loadNewImages = async () => {
    console.log("loadNewImages");
    const lastImageUuid = await getLastImageUuid(context);
    /*  */
    const pictureId = lastImageUuid;
    /*  */
    const response = await getImages({ pictureId, context });
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
    const localImageList = await getLocalImages(context);

    console.log("localImageList", localImageList?.length);
    // if localImageList [] or null, get Images() / show loadingOverlay



    if ((localImageList !== null) && (localImageList?.length < 4) && (!asyncImagesAreLoading)) {
      handleNewImagesLoading();
    };

    if ((localImageList !== null) && (localImageList?.length === 0) && (!asyncImagesAreLoading)) {
      handleNewImagesLoading();
    };

    if ((localImageList !== null) && (localImageList?.length === 0) && (!asyncImagesAreLoading) && (imageList?.length === 0)) {
      return showNoMoreCard();
    };

    if ((localImageList === null) && (!asyncImagesAreLoading) || ((localImageList !== null) && (localImageList?.length === 0) && (!asyncImagesAreLoading) && (imageList === null))) {
      console.log("localImageList === null");
      const response = await getImages({pictureId: null, context});

      if (response.isError === true) {
        Alert.alert(response.title, response.message);
      };

      if (response.isError === false) {
        console.log("response.isError", response.isError);
        await handleData(response.images);
        await saveLastImageUuid(context);
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
    try {
      await removeImageFromList(id, context);
      await FileSystem.deleteAsync(image.imageFile, { idempotent: true });
    } catch (error) {
      errorLog({ functionName: "removeCard", error: error.message });
    };
    setImageList(updatedImageList);

    console.log("updatedImageList removeCard", updatedImageList);

    if ((updatedImageList.length < 4) && (!asyncImagesAreLoading)) {
      handleNewImagesLoading();
      if (updateImageList.length === 0) {
        setNoMoreCard(true);
      };
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

  const handleNewImagesLoading = async () => {
    //console.log("handleNewImagesLoading");
    //console.log("asyncImagesAreLoading", asyncImagesAreLoading);
    //console.log("imageList", imageList);
    if ((!asyncImagesAreLoading) && (imageList !== null) && (imageList?.length < 4)) {
      // const localImageList = await getLocalImages(context);
      await loadNewImages();
      await saveLastImageUuid(context);
      setAsyncImagesAreLoading(false);
      setNoMoreCard(false);
    };
/*  if ((!asyncImagesAreLoading) && (imageList == null)) {
      const localImageList = await getLocalImages();

} */
    return null;
  };

  useLayoutEffect(() => {
    handleGetImagesList();
  }, []);

  useEffect(() => {
    handleNewImagesLoading();
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
          <Text style={styles.titleText}>Zoom to Play or Swipe</Text>
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






