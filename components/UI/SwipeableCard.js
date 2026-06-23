import { useCallback, useMemo, useRef, useState } from 'react';
import { ImageBackground, StyleSheet, PanResponder, Animated, Pressable, Text, View } from 'react-native';

import GuessDescription from '../Picture/Descriptions/GuessDescription';
import BadgeDetailModal from './BadgeDetailModal';
import StarRatingBadge from './StarRatingBadge';
import { MOCK_IMAGE_DETAILS } from '../../data/mock-image-detail';
import { MOCK_RATINGS } from '../../data/mock-ratings';
import { isE2EMode } from '../../utils/e2eMode';

export default function SwipeableCard({ item, removeCard, swipedDirection, screenWidth, screenHeight, onSwipe }) {
  const e2eMode = isE2EMode();
  const badgeRating = MOCK_RATINGS[2];

  // States _________________________________________________________________
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [imageChoice, setImageChoice] = useState(require('../../assets/icons/tears.png'));
  const [detailImage, setDetailImage] = useState(null);
  const xPosition = useRef(new Animated.Value(0)).current;
  const yPosition = useRef(new Animated.Value(0)).current; // Add yPosition
  
  // Variables _______________________________________________________________
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const position = useRef(new Animated.Value(0)).current; // Initialize position as an Animated.Value

  // Functions _______________________________________________________________

  const rotateCard = useMemo(
    () =>
      xPosition.interpolate({
        inputRange: [-200, 0, 200],
        outputRange: ['-20deg', '0deg', '20deg'],
      }),
    [xPosition]
  );

  const yPositionLimits = useMemo(
    () =>
      yPosition.interpolate({
        inputRange: [-screenHeight + 30, 0, screenHeight - 30],
        outputRange: [-30, 0, 30],
      }),
    [screenHeight, yPosition]
  );


  // Function to update overlay color based on position
/*   const interpolatedColor = position.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['red', 'rgba(255, 0, 0, 0)', 'green'],
  }); */

  // Function to update overlay opacity based on overlayPosition
  const overlayOpacity = useMemo(
    () =>
      position.interpolate({
        inputRange: [-150, 0, 150],
        outputRange: [0.5, 0, 0.5],
      }),
    [position]
  );

  const horizontalSwipeThreshold = useMemo(
    () => (e2eMode ? Math.min(screenWidth - 150, 90) : screenWidth - 150),
    [e2eMode, screenWidth]
  );


  const showChoiceImage = useCallback(() => {

    let imageSource;
    if (xPosition._value >= 0) {
      imageSource = require("../../assets/icons/check.png");
    } else if (xPosition._value < 0) {
      imageSource = require("../../assets/icons/bin.png");
    } else {
      imageSource = require("../../assets/icons/bin.png");
    };
    setImageChoice(imageSource); // Update imageSource;
  }, [xPosition]);

  const toggleDescription = useCallback(() => {
    setShowFullDescription((prev) => !prev);
  }, []);

  const openBadgeDetail = useCallback(() => {
    setDetailImage(MOCK_IMAGE_DETAILS.full);
  }, []);

  const closeBadgeDetail = useCallback(() => {
    setDetailImage(null);
  }, []);

  /* overlay on long press ? */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderMove: (evt, gestureState) => {
          xPosition.setValue(gestureState.dx);
          yPosition.setValue(gestureState.dy);

          const { moveX, x0 } = gestureState;
          const distanceFromMiddle = moveX - x0;

          // Keep this a direct setValue to avoid creating a new animation each move.
          position.setValue(distanceFromMiddle);
          showChoiceImage();
        },
        onPanResponderRelease: (evt, gestureState) => {
          if (
            gestureState.dx < horizontalSwipeThreshold &&
            gestureState.dx > -horizontalSwipeThreshold &&
            gestureState.dy > -screenHeight / 3 &&
            gestureState.dy < screenHeight / 3
          ) {
            /* swipedDirection('--'); */
            Animated.parallel([
              Animated.spring(xPosition, {
                toValue: 0,
                speed: 5,
                bounciness: 10,
                useNativeDriver: false,
              }),
              Animated.spring(yPosition, {
                // Reset yPosition
                toValue: 0,
                speed: 5,
                bounciness: 10,
                useNativeDriver: false,
              }),
              Animated.timing(position, {
                toValue: 0,
                duration: 100,
                useNativeDriver: false,
              }),
            ]).start();
          } else if (gestureState.dx > horizontalSwipeThreshold) {
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
              /* swipedDirection(swipeDirection); */
              onSwipe({ item });
            });
          } else if (gestureState.dx < -horizontalSwipeThreshold) {
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
              /* swipedDirection(swipeDirection); */
              removeCard(item.listId);
            });
          } else if (
            gestureState.dy < -screenHeight / 3 &&
            gestureState.dx < horizontalSwipeThreshold &&
            gestureState.dx > -horizontalSwipeThreshold
          ) {
            Animated.parallel([
              Animated.timing(yPosition, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(xPosition, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
            ]).start(() => {
              /* swipedDirection(swipeDirection); */
              toggleDescription();
            });
          } else if (
            gestureState.dy > screenHeight / 3 &&
            gestureState.dx < horizontalSwipeThreshold &&
            gestureState.dx > -horizontalSwipeThreshold
          ) {
            Animated.parallel([
              Animated.timing(yPosition, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(xPosition, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
            ]).start(() => {
              /* swipedDirection(swipeDirection); */
              toggleDescription();
            });
          }
        },
      }),
    [
      cardOpacity,
      item,
      onSwipe,
      position,
      removeCard,
      horizontalSwipeThreshold,
      screenHeight,
      screenWidth,
      showChoiceImage,
      toggleDescription,
      xPosition,
      yPosition,
    ]
  );


  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityLabel={`Swipeable card ${item.listId}`}
      testID={`guess-path.card.${item.listId}`}
      style={[
        styles.cardStyle,
        styles.expanded,
        {
          opacity: cardOpacity,
          transform: [
            { translateX: xPosition }, 
            { rotate: rotateCard }, 
            { translateY: yPositionLimits }],
        },
      ]}>

        {
          item.pictureId === 'e2e-hidden-guess-card' ?
            <View style={styles.e2eMarker} testID="guess-path.card.saved" />
          :
          item.pictureId === 'e2e-guess-card' ?
            <View style={styles.e2eMarker} testID="guess-path.card.fallback" />
          : null
        }

        {
          e2eMode ?
            <Pressable
              accessibilityLabel={`Open guess card ${item.listId}`}
              accessibilityRole="button"
              onPress={() => onSwipe({ item })}
              style={styles.e2eOpenButton}
              testID={`guess-path.card.open.${item.listId}`}
            >
              <Text style={styles.e2eOpenButtonText}>Open</Text>
            </Pressable>
          : null
        }

        <ImageBackground
          accessibilityLabel={`Guess path image ${item.listId}`}
          source={{ uri: item.imageFile}}
          resizeMode='contain'
          style={[styles.imageStyle, styles.expanded]}
          testID={`guess-path.card-image.${item.listId}`} >

          <View style={styles.badgeContainer}>
            <StarRatingBadge
              onPress={openBadgeDetail}
              ratingsCount={badgeRating.count}
              size={36}
              testIDPrefix={`guess-path.card.rating.${item.listId}`}
              value={badgeRating.average}
            />
          </View>
          
          <GuessDescription
            item={item}
            showFullDescription={showFullDescription}
            toggleDescription={toggleDescription} />
        </ImageBackground>

{/*         <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: interpolatedColor, opacity: overlayOpacity }]}
        /> */}


        <Animated.Image
          source={imageChoice}
          resizeMode='contain'
          style={[
            StyleSheet.absoluteFill,
            styles.overlayStyle,
            styles.expanded,
            {
              opacity: overlayOpacity,
            }
          ]} />

        <BadgeDetailModal
          image={detailImage}
          onClose={closeBadgeDetail}
          onOpenFilter={() => {}}
          testIDPrefix={`guess-path.card.rating.${item.listId}.detail`}
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
  e2eMarker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
  },
  e2eOpenButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    backgroundColor: 'rgba(29, 19, 61, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  e2eOpenButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
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
  badgeContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 2,
  },
  overlayStyle: {
    backgroundColor: '#fff',
  },
  buttonStyle: {
    borderRadius: 5,
    padding: 10,
  },
});
