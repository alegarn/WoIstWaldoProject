import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import { OverlayZIndex } from '../../constants/overlayZIndex';

type Props = {
  onSwitch: () => void;
  onLeave: () => void;
  streak?: number;
  message?: string;
};

const DEFAULT_TITLE = 'No more cards';
const BODY_TEXT =
  "You've played every card in this category. Switch to keep your streak going, or leave to bank your score.";

export default function GuessExhaustedPanel({ onSwitch, onLeave, streak, message }: Props) {
  const title = message ?? DEFAULT_TITLE;

  return (
    <View style={styles.overlay} testID="guess-exhausted-panel">
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{BODY_TEXT}</Text>
        {typeof streak === 'number' && (
          <Text style={styles.streak} testID="guess-exhausted-streak">{`Streak: ${streak}`}</Text>
        )}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onSwitch}
          testID="guess-exhausted-switch"
        >
          <Text style={styles.primaryButtonText}>Switch category</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onLeave}
          testID="guess-exhausted-leave"
        >
          <Text style={styles.secondaryButtonText}>Leave game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: OverlayZIndex.EXHAUSTED_PANEL,
  },
  card: {
    width: '85%',
    backgroundColor: GlobalStyle.color.onSurface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: GlobalStyle.color.primaryColor,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  streak: {
    fontSize: 14,
    fontWeight: '600',
    color: GlobalStyle.color.streak.orange,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: GlobalStyle.color.primaryColor,
  },
  primaryButtonText: {
    color: GlobalStyle.color.onSurface,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GlobalStyle.color.primaryColor,
  },
  secondaryButtonText: {
    color: GlobalStyle.color.primaryColor,
    fontSize: 16,
    fontWeight: '600',
  },
});
