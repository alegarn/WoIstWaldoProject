import {ActivityIndicator, StyleSheet, View} from 'react-native';
import { GlobalStyle } from '../../constants/theme';

export default function Spinner() {
  return(
    <View style={[styles.container, styles.horizontal]}>
      <ActivityIndicator size="large" color={GlobalStyle.color.primaryColor} />
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
});
