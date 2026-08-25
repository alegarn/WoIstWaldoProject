import { StyleSheet, Text, Pressable, Animated, ImageBackground, View } from 'react-native';
import { useRef } from 'react';
import { useAccentColor } from '../../store/privateGroupTheme-context';

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

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

  return (
    <Pressable
      pointerEvents={pointerEvents}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.container,
        { flex: heightPercent / 100 },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {backgroundImage ? (
        <AnimatedImageBackground
          source={backgroundImage}
          style={[styles.background, { transform: [{ scale: scaleValue }] }]}
          resizeMode="cover"
        >
          <View style={styles.innerContainer}>
            <Text style={styles.text}>{text}</Text>
          </View>
        </AnimatedImageBackground>
      ) : (
        <Animated.View
          style={[
            styles.innerContainer,
            { backgroundColor: accentColor, transform: [{ scale: scaleValue }] },
          ]}
        >
          <Text style={styles.text}>{text}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 25, // Added 25px border radius as requested (20-30px)
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
