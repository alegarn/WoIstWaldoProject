import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';

export default function ShowSuccess({ navigation, route }) {

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You Found It!</Text>
      <Text>X points earned!</Text>
      <ResultChoices navigation={navigation} success={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
