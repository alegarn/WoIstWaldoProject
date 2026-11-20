import { useState, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import ResultChoices from './ResultChoices';
import RatingSubmissionBlock from './RatingSubmissionBlock';
import ScoreCelebration from './ScoreCelebration';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { AuthContext } from '../../store/auth-context';
import TutorialOverlay from '../UI/TutorialOverlay';

export default function ShowSuccess({ navigation, route }) {
  const { t } = useTranslation();
  const scope = route.params?.scope;
  const isPrivateScope = scope?.kind === 'private';

  const [phase, setPhase] = useState(isPrivateScope ? 'rated' : 'celebration');

  // used to get the image owner and point the user earning points
  const pictureId = route.params?.pictureId;

  const listId = route.params?.listId;
  const isTutorial = route.params?.isTutorial;
  const language = route.params?.language;

  const context = useContext(AuthContext);

  /* Functions ________________________________________________ */

  const handleNextCard = () => navigateToNextGuess(navigation, {
    category: route.params?.category,
    language,
    currentListId: listId,
    isTutorial,
    scope: isPrivateScope ? scope : undefined,
  });

  return (
    <View style={styles.container} testID="result.screen.success.container">
      <View testID="result.screen.success" style={styles.result}>
        <Text testID="result.screen.success.title" style={[styles.title, styles.marginBottom]}>{t('result.successTitle')}</Text>
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
