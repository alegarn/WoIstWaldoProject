import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, View, Text } from 'react-native';

export default function SuccessOverlay({ visible, onDone }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const animRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;

    scale.setValue(0);
    opacity.setValue(1);

    const animation = Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]);

    animRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        onDoneRef.current?.();
      }
    });

    return () => {
      animRef.current?.stop();
    };
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none" testID="guess.success.overlay">
      <Animated.View style={[styles.panel, { transform: [{ scale }], opacity }]}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.label}>+1</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  panel: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 24,
  },
  checkmark: { fontSize: 96, fontWeight: 'bold', color: '#FFFFFF' },
  label: { fontSize: 36, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
});
