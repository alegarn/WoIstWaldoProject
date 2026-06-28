import { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ResultChoices from './ResultChoices';
import RatingSubmissionBlock from './RatingSubmissionBlock';
import ScoreCelebration from './ScoreCelebration';
import { deleteImageFromStorage, removeImageFromList } from '../../utils/storageDatum';
import { updateUserScore } from '../../utils/scoreRequests';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { AuthContext } from '../../store/auth-context';
import TutorialOverlay from '../UI/TutorialOverlay';

export default function ShowSuccess({ navigation, route }) {
  const scope = route.params?.scope;
  const isPrivateScope = scope?.kind === 'private';

  const [phase, setPhase] = useState(isPrivateScope ? 'rated' : 'celebration');

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
    const payload = {
      score: 1,
      pictureId: pictureId,
      context: context,
    };

    if (isPrivateScope) {
      payload.scope = scope;
    }

    const response = await updateUserScore(payload);
  };

  async function handleRemoveImageFromList(listId, imageFilePath) {
    await removeImageFromList(listId, categoryKey, language);
    await deleteImageFromStorage(imageFilePath);
  };

  const handleNextCard = () => navigateToNextGuess(navigation, {
    category: route.params?.category,
    language,
    currentListId: listId,
    isTutorial,
    scope: isPrivateScope ? scope : undefined,
  });

/* useEffect________________________________________________ */

  useEffect(() => {
    handleRemoveImageFromList(listId, imageFilePath);
    handleScore();
  }, [categoryKey, imageFilePath, language, listId, pictureId]);

  return (
    <View style={styles.container} testID="result.screen.success.container">
      <View testID="result.screen.success" style={styles.result}>
        <Text testID="result.screen.success.title" style={[styles.title, styles.marginBottom]}>You Found It!</Text>
        <ScoreCelebration points={1} testIDPrefix="result.celebration" />
        {phase === 'rated' && (
          <ResultChoices
            navigation={navigation}
            route={route}
            success={true}
            isTutorial={isTutorial}
            onNextCard={handleNextCard}
          />
        )}
        {!isPrivateScope && (
          <RatingSubmissionBlock
            pictureId={pictureId}
            context={context}
            onSubmitted={() => setPhase('rated')}
          />
        )}
        {isTutorial && (
          <TutorialOverlay screen={"ShowSuccess"} />
        )}
      </View>
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
  marginBottom: {
    marginBottom: 16,
  }
});
