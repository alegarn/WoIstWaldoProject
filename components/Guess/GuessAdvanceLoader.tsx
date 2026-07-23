import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = { message?: string };

export default function GuessAdvanceLoader({ message = 'Loading next card…' }: Props) {
  return (
    <View style={styles.container} testID="guess-advance-loader" pointerEvents="none">
      <ActivityIndicator />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 8,
    fontSize: 14,
  },
});
