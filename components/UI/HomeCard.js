import { StyleSheet, Text, Pressable, Animated, ImageBackground, View } from 'react-native';
import { useRef } from 'react';
import { useAccentColor } from '../../store/privateGroupTheme-context';

const HomeCard = ({ text, onPress, backgroundImage, heightPercent, testID, accessibilityState, pointerEvents }) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const accentColor = useAccentColor();

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 1.05,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  const Content = (
    <View style={[styles.innerContainer, !backgroundImage && { backgroundColor: accentColor }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        {
          flex: heightPercent / 100,
          transform: [{ scale: scaleValue }]
        }
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityState={accessibilityState}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        testID={testID}
      >
        {backgroundImage ? (
          <ImageBackground source={backgroundImage} style={styles.background} resizeMode="cover">
            {Content}
          </ImageBackground>
        ) : (
          Content
        )}
      </Pressable>
    </Animated.View>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 25, // Added 25px border radius as requested (20-30px)
  },
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  background: {
    flex: 1,
    width: '100%',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', // Slightly darker overlay for better text contrast
  },
  text: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)', // Stronger shadow
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    paddingHorizontal: 10,
  },
});
