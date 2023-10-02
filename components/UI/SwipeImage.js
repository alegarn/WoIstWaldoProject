import { useEffect, useState, useContext } from 'react';
import {  SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import LoadingOverlay from './LoadingOverlay';

import { AuthContext } from '../../store/auth-context';
import { getImages } from '../../utils/requests';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {
  const context = useContext(AuthContext);

  const [imageList, setImageList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noMoreCard, setNoMoreCard] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState('--');


  const handleData = async (data) => {
    const updatedImageList = data.map((image, index) => ({
      ...image,
      listId: index + 1,
    }));

    setImageList(updatedImageList);
    setIsLoading(false);
  };

  const handleGetImagesList = async () => {
    const userId = await AsyncStorage.getItem("userId");
    console.log("handleGetImagesList");
    const response = await getImages();
    console.log("response handleGetImagesList", response);
    await handleData(response);
  };




  const removeCard = (id) => {
    // alert(id);
    const updatedImageList = imageList.filter((item) => item.listId !== id);

    setImageList(updatedImageList);

    // delete image

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
            {Array.isArray(imageList) && imageList.map((item, id) => (
              <GestureCard item={item} gesture={gesture} key={id}/>
            ))}
            {noMoreCard ? showIsLoading() : null}
          </GestureHandlerRootView>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>The list is not there</Text>
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






