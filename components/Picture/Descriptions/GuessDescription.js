import { View, Text, StyleSheet } from 'react-native';
import IconButton from '../../UI/IconButton';

export default function GuessDescription({ item, showFullDescription, toggleDescription, style }) {

  return (
    <View style={[styles.descriptionArea, style]}>
      {(item?.description?.length > 3) && (
          <IconButton
            icon= {showFullDescription ? "chevron-down" : "chevron-up"}
            color="white"
            size={30}
            onPress={toggleDescription} />
        )}
      <Text
        style={styles.cardDescriptionStyle}
        numberOfLines={showFullDescription ? undefined : 3}>
        {item?.description ? item?.description : "No description"}
      </Text>
    </View>
  )
};

const styles = StyleSheet.create({
  descriptionArea: {
    alignItems: 'center',
  },
  cardDescriptionStyle: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
  },
})



/* ▼ Sure! Here's an example code snippet that demonstrates how you can make the `<GuessDescription />` component appear with a left to right double finger gesture:

```javascript
import React, { useState } from 'react';
import { View, ImageBackground, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const App = () => {
  const [showDescription, setShowDescription] = useState(false);
  const [gestureAnimation] = useState(new Animated.Value(0));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (event, gestureState) => {
      if (gestureState.numberActiveTouches === 2 && gestureState.vx > 0) {
        Animated.timing(gestureAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowDescription(true));
      }
    },
    onPanResponderRelease: () => {
      Animated.timing(gestureAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowDescription(false));
    },
  });

  const guessStyles = {
    transform: [
      {
        translateX: gestureAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [screenWidth, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={uriPict}
        style={[styles.image, { width: screenWidth, height: screenHeight }, guessStyles]}
        {...panResponder.panHandlers}
      >
        {showDescription && (
          <GuessDescription
            item={{ description: description }}
            toggleDescription={() => setShowDescription(!showDescription)}
            showFullDescription={true}
          />
        )}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    flex: 1,
    resizeMode: 'cover',
  },
});

export default App;
```

In this code snippet, we use the `PanResponder` API from React Native to detect the left to right double finger gesture. When the gesture is detected, we animate the `translateX` property of the `guessStyles` object to move the `<GuessDescription />` component into view. When the gesture is released, we animate the `translateX` property back to its initial position to hide the component.

Make sure to replace `uriPict` with the actual image URI and customize the styles according to your needs.

I hope this helps! Let me know if you have any further questions. ▼ */
