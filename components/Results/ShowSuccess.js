import { useState, useLayoutEffect, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageAnimated from './ImageAnimated';
import { removeImageFromList } from '../../utils/storageDatum';
import { updateUserScore } from '../../utils/scoreRequests';
import { AuthContext } from '../../store/auth-context';

export default function ShowSuccess({ navigation, route }) {

  
  const [showSuccessImageAnimated, setshowSuccessImageAnimated] = useState(true);
  
  // used to get the image owner and point the user earning points
  const pictureId = route.params?.pictureId;

  const listId = route.params?.listId;

  const context = useContext(AuthContext);

  // used to point the users earning points
  const handleScore = async () => {
    const response = await updateUserScore({
      score: 1,
      pictureId: pictureId,
      context: context
    });
  };

/* useEffect________________________________________________ */
  useLayoutEffect(() => {
    // remove image from list (from the mobile storage)
    removeImageFromList(listId);
    handleScore();
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
