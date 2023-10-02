import { useState } from 'react';
import { ImageBackground, Text, StyleSheet, PanResponder, Animated, View } from 'react-native';

import GuessDescription from '../Picture/Descriptions/GuessDescription';

export default function SwipeableCard({ item, removeCard, swipedDirection, screenWidth }) {

    const [showFullDescription, setShowFullDescription] = useState(false);
    const [xPosition, setXPosition] = useState(new Animated.Value(0));

    let swipeDirection = '';
    let cardOpacity = new Animated.Value(1);
    let rotateCard = xPosition.interpolate({
      inputRange: [-200, 0, 200],
      outputRange: ['-20deg', '0deg', '20deg'],
    });

    let panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
      onPanResponderMove: (evt, gestureState) => {
        xPosition.setValue(gestureState.dx);
        if (gestureState.dx > screenWidth - 250) {
          swipeDirection = 'Right';
        } else if (gestureState.dx < -screenWidth + 250) {
          swipeDirection = 'Left';
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (
          gestureState.dx < screenWidth - 150 &&
          gestureState.dx > -screenWidth + 150
        ) {
          swipedDirection('--');
          Animated.spring(xPosition, {
            toValue: 0,
            speed: 5,
            bounciness: 10,
            useNativeDriver: false,
          }).start();
        } else if (gestureState.dx > screenWidth - 150) {
          Animated.parallel([
            Animated.timing(xPosition, {
              toValue: screenWidth,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(cardOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }),
          ]).start(() => {
            swipedDirection(swipeDirection);
            removeCard();
          });
        } else if (gestureState.dx < -screenWidth + 150) {
          Animated.parallel([
            Animated.timing(xPosition, {
              toValue: -screenWidth,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(cardOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }),
          ]).start(() => {
            swipedDirection(swipeDirection);
            removeCard();
          });
        }
      },
    });


    const toggleDescription = () => {
      setShowFullDescription(!showFullDescription);
    };

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardStyle,
          styles.expended,
          {
            opacity: cardOpacity,
            transform: [{ translateX: xPosition }, { rotate: rotateCard }],
          },
        ]}>

          <ImageBackground
            source={{ uri: item.imageFile}}
            resizeMode='stretch'
            style={[styles.imageStyle, styles.expended]}>
            <GuessDescription
              item={item}
              showFullDescription={showFullDescription}
              toggleDescription={toggleDescription} />
          </ImageBackground>

      </Animated.View>
    );
  };



const styles = StyleSheet.create({
  expended: {
    width: '100%',
    height: '100%',
  },
  cardStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    borderRadius: 7,
  },
  cardTitleStyle: {
    color: '#000',
    fontSize: 24,
  },
  imageStyle: {
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'flex-end'
  },
});
