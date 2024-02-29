import { useRef } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

export default function ImageAnimated({ success }) {
  const imageAnimationValue = useRef(new Animated.Value(0)).current;

  const startSuccessAnimation = () => {
    console.log("startSuccessAnimation");
    Animated.timing(imageAnimationValue, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true
    }).start();
  };

  const startFailureAnimation = () => {
    console.log("startFailureAnimation");
    Animated.timing(imageAnimationValue, {
      toValue: 100,
      duration: 1000,
      easing: Easing.quad,
      useNativeDriver: true,
    }).start();
  };

  // showed 2 times (n°2, 3)

  console.log("success", success);
  success ? startSuccessAnimation() : startFailureAnimation();

  const animationStyle =  success ?
    ({ opacity: imageAnimationValue, width: 300, height: 300 })  :
    ({ transform: [{ translateY: imageAnimationValue }] });

  return (
    <>
      <Animated.Image
        source={success ? require("../../assets/icons/stars.png") : require("../../assets/icons/tears.png")}
        style={[styles.image, animationStyle ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  image: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },

});
