import { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import ImageAnimated from './ImageAnimated';
import RatingSubmissionBlock from './RatingSubmissionBlock';
import { deleteImageFromStorage, removeImageFromList } from '../../utils/storageDatum';
import { updateUserScore } from '../../utils/scoreRequests';
import { AuthContext } from '../../store/auth-context';
import TutorialOverlay from '../UI/TutorialOverlay';

export default function ShowSuccess({ navigation, route }) {

  const [showSuccessImageAnimated, setshowSuccessImageAnimated] = useState(true);
  
  // used to get the image owner and point the user earning points
  const pictureId = route.params?.pictureId;

  const listId = route.params?.listId;
  const imageFilePath = route.params?.imageFile;
  const isTutorial = route.params?.isTutorial;
  const categoryKey = route.params?.category?.key;
  const language = route.params?.language;

  const context = useContext(AuthContext);

  /* Functions ________________________________________________ */

  // used to point the users earning points
  const handleScore = async () => {
    const response = await updateUserScore({
      score: 1,
      pictureId: pictureId,
      context: context
    });
  };

  async function handleRemoveImageFromList(listId, imageFilePath) {
    await removeImageFromList(listId, categoryKey, language);
    await deleteImageFromStorage(imageFilePath);
  };

/* useEffect________________________________________________ */

  useEffect(() => {
    // stop the animation
    const timeout = setTimeout(() => {
      //console.log("showSuccessImageAnimated", showSuccessImageAnimated);
      setshowSuccessImageAnimated(false);
    }, 1000);
    
    handleRemoveImageFromList(listId, imageFilePath);
    handleScore();

    return () => clearTimeout(timeout);
  }, [categoryKey, imageFilePath, language, listId, pictureId]);

  const ShowResult = ({ navigation, isTutorial }) => {
    return (
      <View testID="result.screen.success" style={styles.result}>
        <Text testID="result.screen.success.title" style={[styles.title, styles.marginBottom]}>You Found It!</Text>
        <Text testID="result.screen.success.subtitle" style={[styles.subtitle, styles.marginBottom]}>
          <Text style={styles.title}>1</Text> point earned!
        </Text>
        <ResultChoices 
          navigation={navigation} 
          success={true} 
          isTutorial={isTutorial} 
        />
        <RatingSubmissionBlock pictureId={pictureId} context={context} />
        {
          isTutorial &&
            <TutorialOverlay
              screen={"ShowSuccess"}
            />
        }
      </View>
    );
  };

  return (
    <View style={styles.container} testID="result.screen.success.container">
      {
        showSuccessImageAnimated ?
          <ImageAnimated success={true} />
        :
          <ShowResult 
            navigation={navigation} 
            isTutorial={isTutorial} 
          />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'black',
    textAlign: 'center',
  },
  marginBottom: {
    marginBottom: 16,
  }
});
