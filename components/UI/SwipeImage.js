import { useContext, useLayoutEffect, useState } from 'react';
import {  SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { GestureHandlerRootView/* , GestureDetector, Gesture */ } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { getImages } from '../../utils/imagesRequests';
import { getLocalImages, storeImageList, getLastImageId, emptyImageList, removeImageFromList, updateImageList, getLastImageUuid, saveLastImageUuid, deleteImageFromStorage } from '../../utils/storageDatum';
import { AuthContext } from '../../store/auth-context';
/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, screenHeight, startGuessing }) {

  const [imageList, setImageList] = useState(null);
  const [asyncImagesAreLoading, setAsyncImagesAreLoading] = useState(false);
  const [noMoreCard, setNoMoreCard] = useState(false);

  const context = useContext(AuthContext);

  // Functions __________________________________________________________________

  /*
   * Handles the data received and updates the image list.
   *
   * @param {Array} data - The data to be handled.
   * @return {Promise<boolean>} A promise that resolves to true if the updated image list has elements, false otherwise.
   */
  const handleData = async (data) => {
    console.log("handleData");

    const lastId = await getLastImageId();
    // This is done to add a unique identifier to each object in 'data', which will be used to keep track of the order in which images are displayed.
    const updatedImageList = data?.map((image, index) => ({
     ...image,
     listId: lastId + 1 + index,
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

  async function loadNewImages(context) {
    console.log("loadNewImages");
    const lastImageUuid = await getLastImageUuid();
    const response = await getImages(lastImageUuid, context);

    if (response.isError === true) {
      Alert.alert(response.title, response.message);
      return null;
    };
    if (response.isError === false) {
      //console.log("response.images", response.isError);
      const isCardLeft = await handleData(response.images);
      return isCardLeft;
    };
  };

  /* centralized function for loading images / set when imgs are loading */
  const handleImagesLoading = async () => {
    console.log("handleImagesLoading");

    setAsyncImagesAreLoading(true);
    const isCardLeft = await loadNewImages(context);
    isCardLeft ? null : setNoMoreCard(true);
    setAsyncImagesAreLoading(false);
  };

  /*
  * Handles the retrieval of the list of images.
  *
  * @return {null} Returns null if the localImageList is not null and has a length of at least 4.
  */
  const handleGetImagesList = async () => {
    console.log("handleGetImagesList");

    //await emptyImageList();
    const localImageList = await getLocalImages();

    // if localImageList [] or null, get Images() / show loadingOverlay
    if (localImageList !== null && (localImageList?.length >= 4)) {
      setImageList(localImageList);
    } else {
      // new images are loaded
      await handleImagesLoading();
    };
  };


  const deleteImage = async (id, imageFilePath) => {
    // delete image
    await removeImageFromList(id);
    await deleteImageFromStorage(imageFilePath);
    return null;
  };

  /*
   * Asynchronously removes a card from the image list based on the provided id.
   *
   * @param {string} id - The id of the card to be removed.
   * @return {null}
   */
  const removeCard = async (id) => {
    const updatedImageList = imageList.filter((item) => item.listId !== id);
    const image = imageList.filter((item) => item.listId === id)[0];

    await deleteImage(id, image.imageFile);
    setImageList(updatedImageList);

    if ((updatedImageList?.length < 4) && (!asyncImagesAreLoading)) {
      await handleImagesLoading();
    };
    return null;
  };

  // Effects __________________________________________________________________
  useLayoutEffect(() => {
    if (!asyncImagesAreLoading) {
      handleGetImagesList();
    };
  }, []);

  // Components functions ________________________________________________________
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
                    {[...imageList].reverse().map((item, id) => (
                    //{imageList?.map((item, id) => (
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






