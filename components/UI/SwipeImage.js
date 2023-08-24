import { useState } from 'react';
import {  SafeAreaView, StyleSheet, Text,} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import SwipeableCard from './SwipeableCard';
import Spinner from './Spinner';
import { IMAGES } from "../../data/dummy-data";

function getImagesList() {
  IMAGES.forEach((image, index) => {
    image.id = index + 1;
  });
  return IMAGES;
};

/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */

export default function SwipeImage({ screenWidth, startGuessing }) {

  const imageList = getImagesList();

  const [noMoreCard, setNoMoreCard] = useState(false);
  const [sampleCardArray, setSampleCardArray] = useState(imageList);
  const [swipeDirection, setSwipeDirection] = useState('--');

  const removeCard = (id) => {
    // alert(id);
    sampleCardArray.splice(
      sampleCardArray.findIndex((item) => item.id == id),
      1
    );
    setSampleCardArray(sampleCardArray);
    if (sampleCardArray.length == 0) {
      setNoMoreCard(true);
    }
  };

  const lastSwipedDirection = (swipeDirection) => {
    // nop left / later right ?
    setSwipeDirection(swipeDirection);
  };


  const gesture = Gesture.Pan()
    .onEnd(() => {
    const item = sampleCardArray.slice(-1)[0];
    startGuessing({item});
  });


  const showIsLoading = () => (
    <Spinner size="large" color="#0000ff" />
  )


  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text style={styles.titleText}>
        Zoom to Play or Swipe
      </Text>
      <GestureHandlerRootView style={styles.container}>

          {sampleCardArray.map((item, key) => {
            return(
              <GestureDetector gesture={gesture} key={key}>
                <SwipeableCard
                  item={item}
                  removeCard={() => removeCard(item.id)}
                  swipedDirection={lastSwipedDirection}
                  screenWidth={screenWidth}
                  onPress={startGuessing}
                />
              </GestureDetector>)
          }
          )}

        {noMoreCard ? (
          showIsLoading()
        ) : null}

      </GestureHandlerRootView>
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
