import {  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Pressable,} from 'react-native';
import { useState } from 'react';
import SwipeableCard from './SwipeableCard';
import { IMAGES } from "../../data/dummy-data";


function getImagesList() {
  IMAGES.reverse().forEach((image, index) => {
    image.id = index + 1;
  });
  return IMAGES;
};






/* https://snack.expo.dev/embedded/@aboutreact/tinder-like-swipeable-card-example?preview=true&platform=ios&iframeId=0kofaqg0vl&theme=dark */
/* https://snack.expo.dev/@jemise111/react-native-swipe-list-view?platform=android */
/* https://snack.expo.dev/@guardme/react-native-swipe-list-view */




/*   console.log(imageList[0].imageFile);
 */
  /* file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252FWoIstWaldoProject-235146bf-9d5d-410d-b01e-f25db89d03b9/ImagePicker/48f5ccf2-9ff4-43f2-86b2-357224abea7b.jpeg */
  /* file:///data/media/0/DCIM/cb204388-f5b5-4f7d-8d9f-8fdd0fa44a3b.jpeg */
/* file:///data/media/0/Download/1_tree.jpg */
/* <Image style={styles.image} source={require('../assets/images/success-image.jpeg')} /> */




export default function SwipeImage({ screenWidth }) {

  const imageList = getImagesList();
/*   console.log("images", imageList);

  console.log(imageList[0].imageFile); */

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
    setSwipeDirection(swipeDirection);
  };

  const startGuessing = () => {
    console.log("start guessing");
  }


  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text style={styles.titleText}>
        Tap to Play or Swipe
      </Text>
      <View style={styles.container}>
        {sampleCardArray.map((item, key) => {
          return(
              <SwipeableCard
                key={key}
                item={item}
                removeCard={() => removeCard(item.id)}
                swipedDirection={lastSwipedDirection}
                screenWidth={screenWidth}
                onPress={startGuessing}
              />)
        }

        )}
        {noMoreCard ? (
          <Text style={{ fontSize: 22, color: '#000' }}>No Cards Found.</Text>
        ) : null}

      </View>
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
