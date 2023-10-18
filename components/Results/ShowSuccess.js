import { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageAnimated from './ImageAnimated';
import { removeImageFromList } from '../../utils/storageDatum';
import { updateUserScore } from '../../utils/scoreRequests';

export default function ShowSuccess({ navigation, route }) {

  const [showSuccessImageAnimated, setshowSuccessImageAnimated] = useState(true);
  const pictureId = route.params?.pictureId;
  const listId = route.params?.listId;

  const handleScore = async () => {
    const response = await updateUserScore({
      score: 1,
      pictureId: pictureId
    });
  };


  useLayoutEffect(() => {
    removeImageFromList(listId);
    handleScore();
    // score: pictureId, userId
  }, []);

  useLayoutEffect(() => {
    const timeout = setTimeout(() => {
      setshowSuccessImageAnimated(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  const ShowResult = ({ navigation }) => {
    return (
      <>
        <Text style={[styles.title, styles.marginBottom]}>You Found It!</Text>
        <Text style={[styles.subtitle, styles.marginBottom]}>
          <Text style={styles.title}>1</Text> point earned!
        </Text>
        <ResultChoices navigation={navigation} success={true} />
      </>
    );
  };

  return (
    <View style={styles.container}>
      {showSuccessImageAnimated ?
          <ImageAnimated success={true} />
        :
          <ShowResult navigation={navigation} />
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
