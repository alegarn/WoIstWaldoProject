import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';

export default function IconButton({ icon, color, size, onPress, style, testID, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={(pressed) => pressed ? [styles.pressed, style] : [styles.button, style]}
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
  iconContainer: {
    position: 'relative',
    top: '-5%',
    left: '1%'
  },
})
