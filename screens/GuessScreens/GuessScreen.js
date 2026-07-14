import { useCallback, useContext, useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

import GuessExitSwipeMenu from '../../components/Guess/GuessExitSwipeMenu';
import GuessPicture from "../../components/Picture/GuessPicture";
import SuccessOverlay from '../../components/Guess/SuccessOverlay';
import TutorialOverlay from '../../components/UI/TutorialOverlay';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { AuthContext } from '../../store/auth-context';
import { isOnTarget } from "../../utils/targetLocation";
import { applySuccessSideEffects, resolveNextGuessParams } from '../../utils/handleGuessOutcome';
import { navigateToNextGuess } from '../../utils/guessNavigation';
import { isE2EMode } from '../../utils/e2eMode';
import { computeMultiplier, isSpeedBonus, computeSpeedPoints, SPEED_MULTIPLIER_BASE } from '../../utils/speedMultiplier';

export default function GuessScreen({ navigation, route }) {

  const { imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, listId, isTutorial, category, language, scope, skipInstructions } = route.params;
  const isPrivate = scope?.kind === 'private';

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMultiplier, setSuccessMultiplier] = useState(SPEED_MULTIPLIER_BASE);
  // Hints show on the first card of each game series (every fresh mount of
  // GuessScreen). Advancing to later cards uses setParams (no remount), so the
  // dismissed state persists for the rest of the series. Suppressed in e2e mode.
  const [hintsActive, setHintsActive] = useState(!isE2EMode());
  const dismissHints = useCallback(() => setHintsActive(false), []);

  const { userId } = useContext(AuthContext);

  const { group, theme } = useScopedPrivateGroupTheme(scope);

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const uri = imageFile;

  let screenDimensions = {};
  isPortrait ?
    (screenDimensions = { width: screenWidth, height: screenHeight }) :
    (screenDimensions = { width: screenHeight, height: screenWidth });


  async function toAdScreen(targetInfos) {
    let onTarget = isOnTarget(targetInfos);
    // Missing elapsedMs is treated as 0 by design: yields the fastest tier (fastest-find reward), preserving backward compatibility for callers that don't pass it.
    const elapsedMs = targetInfos?.elapsedMs ?? 0;
    const multiplier = computeMultiplier(elapsedMs);
    // Forward-looking speed-bonus reward gate: no ad hop exists on success today,
    // but when AdScreen is restored this flag (multiplier > 1) will skip the ad for fast finds.
    isSpeedBonus(multiplier);
    const sharedParams = {
      onTarget: onTarget,
      imageFile: uri,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      listId: listId,
      isTutorial: isTutorial,
      category,
      language,
      scope,
    };

    if (onTarget) {
      await applySuccessSideEffects({ listId, categoryKey: category?.key, language, imageFile: uri, pictureId, scope, userId, points: computeSpeedPoints(1, multiplier), multiplier });
      setSuccessMultiplier(multiplier);
      setShowSuccess(true);
      return;
    }

    navigation.replace('ResultScreen', sharedParams);
  };

  async function handleOverlayDone() {
    const next = await resolveNextGuessParams({ category, language, currentListId: listId, isTutorial, scope });
    setShowSuccess(false);
    if (!next) {
      navigateToNextGuess(navigation, { category, language, currentListId: listId, isTutorial, scope: isPrivate ? scope : undefined });
      return;
    }
    navigation.setParams(next.params);
  }

  function handleExitToHome() {
    navigation.popToTop();
  }


  return(
    <PrivateGroupThemeProvider group={group}>
    <>
    <GuessExitSwipeMenu onHome={handleExitToHome} showHints={hintsActive} onInteract={dismissHints} />
    <GuessPicture
      key={listId}
      navigation={navigation}
      // only in dev with local images, but imageFile in Prod
      imageFile={uri}
      pictureId={pictureId}
      description={description}
      imageIsPortrait={isPortrait}
      imageHeight={imageHeight}
      imageWidth={imageWidth}
      hiddenLocation={hiddenLocation}
      screenDimensions={screenDimensions}
      toAdScreen={toAdScreen}
      skipInstructions={skipInstructions}
      pulseTarget={hintsActive}
      onInteract={dismissHints}
    />
    <SuccessOverlay visible={showSuccess} multiplier={successMultiplier} points={computeSpeedPoints(1, successMultiplier)} onDone={handleOverlayDone} />
    {
      isTutorial && 
        <TutorialOverlay
         screen={"GuessScreen"}
         isPortrait={isPortrait}
        />
      }
    </>  
    </PrivateGroupThemeProvider>
  );
};
