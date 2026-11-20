import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from '@react-native-vector-icons/ionicons';

export default function IconButton({ icon, color, size, onPress, style, testID, accessibilityLabel, disabled }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={(pressed) => pressed ? [styles.pressed, style, disabled && styles.disabled] : [styles.button, style, disabled && styles.disabled]}
      testID={testID}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={size} color={color} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    /* padding: 10, */
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
  iconContainer: {
    position: 'relative',
    top: '-5%',
    left: '1%'
  },
})
