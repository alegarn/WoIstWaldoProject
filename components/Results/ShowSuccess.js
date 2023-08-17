import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageAnimated from './ImageAnimated';

export default function ShowSuccess({ navigation }) {

  const [showSuccessImageAnimated, setshowSuccessImageAnimated] = useState(true);


  useEffect(() => {
    const timeout = setTimeout(() => {
      setshowSuccessImageAnimated(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      {showSuccessImageAnimated ?
          <ImageAnimated success={true} />
        :
          <>
            <Text style={[styles.title, styles.marginBottom]}>You Found It!</Text>
            <Text style={[styles.subtitle, styles.marginBottom]}>
              <Text style={styles.title}>X</Text> points earned!
            </Text>
            <ResultChoices navigation={navigation} success={true} />
          </>
      }
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
    fontSize: 28,
    fontWeight: 'bold',

  },
  subtitle: {
    fontSize: 18,
  },
  marginBottom: {
    marginBottom: 16,
  }
});
