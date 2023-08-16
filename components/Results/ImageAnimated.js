import { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';

export default function ImageAnimated({ success }) {

  const imagePosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAnimation();
  }, []);


  const startAnimation = () => {
    Animated.timing(imagePosition, {
      toValue: 100,
      duration: 2000,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <Animated.Image
        source={success ? null : require("../../assets/images/tears.png")}
        style={[styles.image, success ? {} : { transform: [{ translateY: imagePosition }] }]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  image: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    height: '90%',
  },

});
