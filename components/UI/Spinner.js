import {ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

export default function Spinner({ message }) {
  return(
    <View style={[styles.container, styles.horizontal]}>
      <Text style={styles.message}>{message}</Text>
      <ActivityIndicator size="large" color={GlobalStyle.color.secondaryColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  horizontal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  message: {
    color: GlobalStyle.color.primaryColor,
  },
});
