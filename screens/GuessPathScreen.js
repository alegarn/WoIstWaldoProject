import SwipeImage from '../components/UI/SwipeImage';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width


import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../store/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImages } from '../utils/requests';

import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import SwipeableCard from '../components/UI/SwipeableCard';

export default function GuessPathScreen({ navigation, route }) {

  const startGuessing = ({item}) => {
    navigation.replace('GuessScreen', {
      accountId: item.accountId,
      imageFile: item.imageFile,
      pictureId: item.pictureId,
      description: item.description,
      imageHeight: item.imageHeight,
      imageWidth: item.imageWidth,
      isPortrait: item.isPortrait,
      hiddenLocation: item.touchLocation,
      screenHeight: item.screenHeight,
      screenWidth: item.screenWidth});
  };

/*  */

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
  const response = await getImages({ token: context.token, uid: context.uid, userId: userId, expiry: context.expiry, access_token: context.access_token, client: context.client });
  console.log("response handleGetImagesList", response);
  await handleData(response);

};

useEffect(() => {
  handleGetImagesList();
}, []);

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


  const showIsLoading = () => {
    const message='Loading new images...';
    return <LoadingOverlay message={message} />
  };


  const GestureCard = ({item, gesture, key}) => {
    return(
    <>
      <GestureDetector gesture={gesture} key={key}>
        <SwipeableCard
          item={item}
          removeCard={() => removeCard(item.listId)}
          swipedDirection={lastSwipedDirection}
          screenWidth={screenWidth}
          onPress={startGuessing}
        />
      </GestureDetector>
    </>

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
            {imageList.map((item) => (
              <GestureCard item={item} gesture={gesture} key={item.listId} />
            ))}
            {noMoreCard ? showIsLoading() : null}
          </GestureHandlerRootView>
        </>
        ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>The list is not there</Text>
        </View>
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

/*       <SwipeImage
        screenWidth={SCREEN_WIDTH}
        startGuessing={startGuessing}
      /> */
