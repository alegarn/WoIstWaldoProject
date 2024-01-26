import { useState } from 'react';
import { ImageBackground, StyleSheet, PanResponder, Animated, View } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

import GuessDescription from '../Picture/Descriptions/GuessDescription';

export default function SwipeableCard({ item, removeCard, swipedDirection, screenWidth, screenHeight, onSwipe }) {

    const [showFullDescription, setShowFullDescription] = useState(false);
    const [xPosition, setXPosition] = useState(new Animated.Value(0));
    const [yPosition, setYPosition] = useState(new Animated.Value(0)); // Add yPosition


    let swipeDirection = '';
    let cardOpacity = new Animated.Value(1);
    const position = new Animated.Value(0); // Initialize position as an Animated.Value

    let rotateCard = xPosition.interpolate({
      inputRange: [-200, 0, 200],
      outputRange: ['-20deg', '0deg', '20deg'],
    });

    let yPositionLimits = yPosition.interpolate({
      inputRange: [-screenHeight + 30, 0, screenHeight - 30],
      outputRange: [-30, 0, 30],
    });


    // Function to update overlay color based on position
    const interpolatedColor = position.interpolate({
      inputRange: [-100, 0, 100],
      outputRange: ['red', 'rgba(255, 0, 0, 0)', 'green'],
    });

    const overlayOpacity = position.interpolate({
      inputRange: [-100, 0, 100],
      outputRange: [0.25, 0, 0.25],
    })

    /* overlay on long press ? */
    let panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
      onPanResponderMove: (evt, gestureState) => {
        xPosition.setValue(gestureState.dx);
        yPosition.setValue(gestureState.dy);

        const { moveX, x0 } = gestureState;
        const distanceFromMiddle = moveX - x0;

        // change position value based on distance from middle
        Animated.timing(position, {
          toValue: distanceFromMiddle,
          duration: 100, // No animation duration
          useNativeDriver: false, // Use native driver for performance
        }).start();

        if (gestureState.dx > screenWidth - 250) {
          swipeDirection = 'Right';
        } else if (gestureState.dx < -screenWidth + 250) {
          swipeDirection = 'Left';
        };

        if (gestureState.dy < -screenHeight + 30) { // Swipe up threshold
          swipeDirection = 'Up'; // Set swipe direction to Up
          toggleDescription();
        } else if (gestureState.dy > screenHeight - 30) { // Swipe down threshold
          swipeDirection = 'Down'; // Set swipe direction to Down
          toggleDescription();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (
          gestureState.dx < screenWidth - 150 &&
          gestureState.dx > -screenWidth + 150 &&
          gestureState.dy < screenHeight - screenHeight / 2 &&
          gestureState.dy > -screenHeight + screenHeight / 2
        ) {
          swipedDirection('--');
          Animated.spring(xPosition, {
            toValue: 0,
            speed: 5,
            bounciness: 10,
            useNativeDriver: false,
          }).start();
          Animated.spring(yPosition, { // Reset yPosition
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
            /* removeCard(); */
            onSwipe({item});
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
        } else if (gestureState.dy < -screenHeight + 10) {
          Animated.parallel([
            Animated.timing(yPosition, {
              toValue: 0, /* screenHeight */
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(xPosition, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            })
          ]).start(() => {
            /* swipedDirection(swipeDirection); */
            toggleDescription();
          });
        } else if (gestureState.dy < screenHeight - 10) {
          Animated.parallel([
            Animated.timing(yPosition, {
              toValue: 0, /* screenHeight */
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(xPosition, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            })
          ]).start(() => {
            /* swipedDirection(swipeDirection); */
            toggleDescription();
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
          styles.expanded,
          {
            opacity: cardOpacity,
            transform: [{ translateX: xPosition }, { rotate: rotateCard }, { translateY: yPositionLimits }],
          },
        ]}>

          <ImageBackground
            source={{ uri: item.imageFile}}
            resizeMode='contain'
            style={[styles.imageStyle, styles.expanded]} >
            
            <GuessDescription
              item={item}
              showFullDescription={showFullDescription}
              toggleDescription={toggleDescription} />
          </ImageBackground>

          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: interpolatedColor, opacity: overlayOpacity }]}
          />

      </Animated.View>
    );
  };


/*             <Button 
              title="Press me or Swipe"
              onPress={() => onPress({item})}
              style={styles.buttonStyle}
              color={GlobalStyle.color.secondaryColor} /> */
const styles = StyleSheet.create({
  expanded: {
    width: '100%',
    height: '100%',
  },
  cardStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  cardTitleStyle: {
    color: '#000',
    fontSize: 24,
  },
  imageStyle: {
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'flex-end',
  },
  buttonStyle: {
    borderRadius: 5,
    padding: 10,
  },
});
