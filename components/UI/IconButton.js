import { Pressable, StyleSheet } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';

export default function IconButton({ icon, color, size, onPress}) {
  return (
    <Pressable onPress={onPress} style={(pressed) => pressed ? styles.pressed : styles.button}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 10,
  },
  pressed: {
    opacity: 0.75,
  },
})
