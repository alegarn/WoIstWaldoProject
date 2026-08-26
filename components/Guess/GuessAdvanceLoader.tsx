import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type Props = { message?: string };

export default function GuessAdvanceLoader({ message }: Props) {
  const { t } = useTranslation();
  const text = message ?? t('guess.advanceLoader.message');

  return (
    <View style={styles.container} testID="guess-advance-loader" pointerEvents="none">
      <ActivityIndicator />
      <Text style={styles.text}>{text}</Text>
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
