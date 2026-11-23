import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';

import ResultChoices from './ResultChoices';
import TutorialOverlay from '../UI/TutorialOverlay';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { useAuthContext } from '../../store/auth-context';
import { useSessionModeFilter } from '../../store/sessionFilter-context';
import { flush } from '../../utils/sessionScoreStore';
import type { AdScope } from '../../utils/adCadence';
import type { Point } from '../../utils/shapeGeometry';
import type { GuessNavigationProp } from '../../utils/guessNavigation';

type HiddenLocation = { x: number; y: number };
type GuessCategory = { id?: string; key?: string; [key: string]: unknown };
type ImageMode = 'point' | 'shape';
type ShapeOutline = Point[];

type ShowFailureRouteParams = {
  imageFile?: string;
  pictureId?: string;
  description?: string;
  imageHeight?: number;
  imageWidth?: number;
  isPortrait?: boolean;
  hiddenLocation?: HiddenLocation;
  screenHeight?: number;
  screenWidth?: number;
  isTutorial?: boolean;
  listId?: number;
  category?: GuessCategory;
  language?: string | null;
  scope?: AdScope;
  mode?: ImageMode;
  shape?: ShapeOutline | null;
};

type RetryParams = Omit<ShowFailureRouteParams, 'mode' | 'shape'> & {
  mode?: ImageMode;
  shape?: ShapeOutline | null;
};

// The navigation object crosses untyped .js boundaries (ResultChoices,
// guessNavigation) and tests pass `Record<string, jest.Mock>`-style mocks, so
// required members can't be enforced at this boundary — every member stays
// optional and call sites cast to the shape they need.
type ShowFailureNavigation = {
  replace?(name: string, params?: Record<string, unknown>): void;
  reset?(state: { index: number; routes: Array<{ name: string; params?: Record<string, unknown> }> }): void;
};

type ShowFailureProps = {
  navigation: ShowFailureNavigation;
  route: { params: ShowFailureRouteParams };
};

const ShowFailure: FC<ShowFailureProps> = ({ navigation, route }) => {

  const { t } = useTranslation();
  const authContext = useAuthContext();

  const {
    imageFile, 
    pictureId, 
    description, 
    imageHeight, 
    imageWidth, 
    isPortrait, 
    hiddenLocation, 
    screenHeight, 
    screenWidth, 
    isTutorial,
    listId,
    category,
    language,
    scope,
    mode,
    shape
  } = route?.params;

  const isPrivateScope = scope?.kind === 'private';

  // Session mode filter (context), NOT the card's own `mode` route param above —
  // distinct concerns: `mode` = card's stored shape mode (retry path), `sessionMode` = filter.
  const { mode: sessionMode } = useSessionModeFilter();

  const pulse = useRef(new Animated.Value(0)).current;

/* useEffect________________________________________________ */

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  useEffect(() => {
    void flush({ authContext });
  }, []);

  const messageScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });


/* functions________________________________________________ */
  function retryGuess() {
    const params: RetryParams = {
      imageFile: imageFile,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isTutorial: isTutorial,
      listId: listId,
      category: category,
      language: language,
      // Shape mode survives the retry: the re-mounted card must render the
      // shape surface with the card's STORED outline (hidden `shape`), the
      // same threading as GuessScreen.toAdScreen's sharedParams. Point cards
      // carry no mode key — params stay byte-identical.
      ...(mode === 'shape' ? { mode, shape } : {}),
    };

    if (isPrivateScope) {
      params.scope = scope;
    }

    (navigation as GuessNavigationProp & { replace(name: string, params?: Record<string, unknown>): void }).replace('GuessScreen', params);
  };

  const handleNextCard = () => navigateToNextGuess(navigation as GuessNavigationProp, {
    category,
    language,
    currentListId: listId,
    isTutorial,
    scope: isPrivateScope ? scope : undefined,
    mode: sessionMode,
  });

  return (
    <>
      <View style={styles.container}>
        <View testID="result.screen.failure" style={styles.result}>
          <Animated.Text
            testID="result.screen.failure.title"
            style={[styles.title, { transform: [{ scale: messageScale }] }]}
          >
            {t('result.failureTitle')}
          </Animated.Text>
          <ResultChoices 
            navigation={navigation} 
            route={route}
            retryGuess={retryGuess} 
            success={false} 
            isTutorial={isTutorial} 
            onNextCard={handleNextCard}
          />
        </View>
      </View>
      {
        isTutorial &&
          <TutorialOverlay
            screen={"ShowFailure"}
          />
      }
    </>
  );
};

export default ShowFailure;

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
    marginBottom: 16,
  },

});
