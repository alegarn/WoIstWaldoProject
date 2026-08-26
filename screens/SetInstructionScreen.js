import { useRef, useState, useContext, useEffect } from 'react';
import { View, ImageBackground, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';

import { AuthContext } from "../store/auth-context";

import HideDescription from '../components/Picture/Descriptions/HideDescription';
import CenteredModal from "../components/UI/CenteredModal";
import ModalContent from '../components/UI/ModalContent';
import TutorialOverlay from '../components/UI/TutorialOverlay';
import { imageUploader } from "../utils/fileUploader";
import { buildE2EHiddenGuessPayload, isE2EMode } from '../utils/e2eMode';
import { handleOrientation } from '../utils/orientation';
import { handleImageType, isTypeValid } from '../utils/imageInfos';
import { getPreferredLanguage, saveE2EHiddenGuessCard } from '../utils/storageDatum';
import { getCategories } from '../utils/categoryRequests';
import { getDefaultCategories } from '../constants/defaultCategories';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { loadGroupCategoriesOptimistic } from '../services/groups/groupCategoriesStore';

import LoadingOverlay from '../components/UI/LoadingOverlay';
import { checkSecureStoreItem } from '../utils/auth';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../store/privateGroupTheme-context';

const NON_UPLOAD_CATEGORY_KEYS = new Set(['all']);

function isUploadableCategoryKey(categoryKey) {
  return typeof categoryKey === 'string' && !NON_UPLOAD_CATEGORY_KEYS.has(categoryKey);
}

function normalizeUploadCategoryKey(categoryKey) {
  return isUploadableCategoryKey(categoryKey) ? categoryKey : null;
}

// Upload-error payloads come from non-React transports (utils/imagesRequests.js)
// as English title/message strings. Mapping them here to i18n keys keeps the
// transports untouched; unknown strings fall back to themselves via
// t(raw, { defaultValue: raw }) — same boundary pattern as SwipeImage's
// guess.feedErrors.* mapping.
const UPLOAD_ERROR_KEYS = {
  'Unauthorized, please try to reconnect': 'errors.unauthorized',
  'Internal server error, please wait and try again': 'errors.serverError',
  'Something went wrong, please try again later': 'errors.generic',
};
const UPLOAD_FILE_GONE_PREFIX = 'Your file might not exist anymore but should be uploaded. You can continue to play.';
const UPLOAD_UNSUPPORTED_METHOD_PREFIX = 'Unsupported upload method: ';

export default function SetInstructionsScreen({ navigation, route }) {
  const { t } = useTranslation();

  const translateUploadErrorText = (raw) => {
    if (typeof raw !== 'string' || raw === '') {
      return raw;
    }
    if (UPLOAD_ERROR_KEYS[raw]) {
      return t(UPLOAD_ERROR_KEYS[raw]);
    }
    if (raw.startsWith(UPLOAD_FILE_GONE_PREFIX)) {
      return t('errors.uploadFileGone') + raw.slice(UPLOAD_FILE_GONE_PREFIX.length);
    }
    if (raw.startsWith(UPLOAD_UNSUPPORTED_METHOD_PREFIX)) {
      return t('errors.uploadUnsupportedMethod', { method: raw.slice(UPLOAD_UNSUPPORTED_METHOD_PREFIX.length) });
    }
    return t(raw, { defaultValue: raw });
  };

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState(null);
  const [languageError, setLanguageError] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const languageTouchedRef = useRef(false);
  const isMountedRef = useRef(true);

  const {
    uri,
    imageWidth,
    imageHeight,
    screenHeight,
    screenWidth,
    isPortrait,
    touchLocation,
    target,
    imageDimensionStyle,
    isTutorial,
    scope,
  } = route?.params;

  const context = useContext(AuthContext);
  const isPrivateScope = scope?.kind === 'private' && !!scope?.groupId;
  const { group, theme } = useScopedPrivateGroupTheme(scope);
  const selectableCategories = categories.filter((category) => isUploadableCategoryKey(category?.key));

  const loadCategories = async () => {
    if (isPrivateScope) {
      await loadGroupCategoriesOptimistic({
        context,
        groupId: scope.groupId,
        onCategories: (nextCategories) => {
          setCategories(nextCategories);
          setCategoriesError(null);
        },
      });
      return;
    }

    if (isE2EMode()) {
      const categoriesResponse = await getCategories({ context });

      if (!isMountedRef.current) {
        return;
      }

      setCategories(categoriesResponse?.data ?? []);
      setCategoriesError(null);
      return;
    }

    setCategories(getDefaultCategories().data);
    setCategoriesError(null);
  };

  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;

    (async () => {
      const [preferred] = await Promise.all([
        getPreferredLanguage(),
        loadCategories(),
      ]);

      if (!mounted) {
        return;
      }

      const defaultLanguage = preferred || resolveDefaultLanguage() || 'en';

      if (!languageTouchedRef.current) {
        setLanguage((currentLanguage) => currentLanguage || defaultLanguage);
        if (defaultLanguage) {
          setLanguageError(false);
        }
      }
    })();

    return () => {
      mounted = false;
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!theme) {
      return;
    }

    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  const getPermissions = async () => {
    let currentPermission = permissionResponse;

    // Detect if you can request this permission again
    if (permissionResponse.status === "undetermined") {
      currentPermission = await requestPermission();
    };
    if (!currentPermission?.canAskAgain || currentPermission?.status === "denied") {
      Alert.alert(t('hide.insufficientPermissions'), t('hide.photosDenied'));
      Linking.openSettings();
    } else {
      if (currentPermission?.status === "granted") {
        return true;
      };
    };
  };

  const handlePressDescription = async (enteredText) => {
    setDescription(enteredText);
    setShowModal(true);
  };

  const onCancelGoBack = () => {
    const params = { uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, isTutorial };
    if (isPrivateScope) {
      params.scope = scope;
    }
    navigation.replace("HideScreen", params);
  };

  const handleImage = async ({userId, fileExtension}) => {
    const selectedCategoryObject = selectableCategories.find((category) => category.key === selectedCategory);
    const scopeCategoryInfos = isPrivateScope
      ? { categoryId: selectedCategoryObject?.id ?? null }
      : { categoryKey: selectedCategoryObject?.key ?? null };
    const imageInfos = {
      uri: uri,
      userId: userId,
      fileExtension: fileExtension,
      imageHeight: imageHeight,
      imageWidth: imageWidth,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      description: description,
      isPortrait: isPortrait,
      xLocation: touchLocation.x,
      yLocation: touchLocation.y,
      language: language,
      ...scopeCategoryInfos,
    };

    setIsLoading(true);

    try {
      const uploaderArgs = { imageInfos, context };
      if (isPrivateScope) {
        uploaderArgs.scope = scope;
      }

      const uploadState = await imageUploader(uploaderArgs);

      if (uploadState.status !== 200) {
        setIsLoading(false);
        Alert.alert(`${t('hide.uploadingError')}: ${translateUploadErrorText(uploadState.title)}`, `${translateUploadErrorText(uploadState.message)}\n${t('hide.tryAgainLater')}`);
        return uploadState;
      };

      return uploadState;
    } catch (error) {
      setIsLoading(false);
      Alert.alert(t('hide.uploadingError'), `${error?.message || t('hide.unexpectedError')}\n${t('hide.tryAgainLater')}`);
      return { status: 500 };
    }
  };

  const handleScreenUi = () => {
    setShowModal(false);
    handleOrientation("portrait");
    setIsLoading(false);
  };

  const handleTutorialUpdate = async () => {
    await context.updateTutorialStatus({ 
      isTutorial: true, 
      guessPathDone: context.isTutorialFinished?.guessPathDone, 
      hidePathDone: true,
    });
  };

  const saveE2EGuessBridge = async () => {
    if (!isE2EMode()) {
      return;
    }

    await saveE2EHiddenGuessCard(
      buildE2EHiddenGuessPayload({
        uri,
        description,
        imageHeight,
        imageWidth,
        isPortrait,
        hiddenLocation: {
          x: touchLocation.x,
          y: touchLocation.y,
        },
        screenHeight,
        screenWidth,
      })
    );
  };

  const resetToHome = async () => {
    handleScreenUi();
    isTutorial && await handleTutorialUpdate();

    const routeEntry = isPrivateScope
      ? {
          name: 'PrivateHomeScreen',
          params: { scope, isTutorial, hidePathDone: true },
        }
      : {
          name: 'HomeScreen',
          params: {
            isTutorial: isTutorial,
            hidePathDone: true,
          },
        };

    navigation.reset({
      index: 0,
      routes: [routeEntry],
    });
  };

  const handleConfirmModal = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setShowModal(false);

    try {

      if (isE2EMode()) {
        await saveE2EGuessBridge();
        await resetToHome();
        return;
      }

      if (!language) {
        setLanguageError(true);
        return;
      }
      setLanguageError(false);

      let permissionStatus = await getPermissions();
      if (!permissionStatus) {
        return;
      };
 
      const fileExtension = handleImageType(uri);
      const validType = isTypeValid(fileExtension);

      if (!validType) {
        Alert.alert(t('hide.invalidTypeTitle'), t('hide.invalidTypeMessage'));
        return;
      };

      const userId = await checkSecureStoreItem({ secureStoreValue: "userId", context });

      const uploadState = await handleImage({userId, fileExtension});

      if (uploadState?.status !== 200) {
        return;
      };

      await saveE2EGuessBridge();

      await resetToHome();
    } finally {
      isSubmittingRef.current = false;
    }

  };

  const onCancelModal = () => {
    setShowModal(false);
  };

  const handleLanguageChange = (code) => {
    languageTouchedRef.current = true;
    setLanguage(code);
    setLanguageError(false);
  };

  const handleCategorySelect = (categoryKey) => {
    const normalizedCategoryKey = normalizeUploadCategoryKey(categoryKey);

    setSelectedCategory((currentCategory) => (
      currentCategory === normalizedCategoryKey ? null : normalizedCategoryKey
    ));
  };


  if (isLoading) {
    return <LoadingOverlay message={t('hide.uploading')} />;
  };


  return (
    <PrivateGroupThemeProvider group={group}>
      <View style={styles.container} testID="set-instructions.screen">
        <ImageBackground
          accessibilityLabel={t('hide.setInstructionsImageLabel')}
          source={{uri : uri}}
          resizeMode='stretch'
          style={imageDimensionStyle}
          testID="set-instructions.image"
        >
          <HideDescription
            onSubmit={handlePressDescription}
            onCancel={onCancelGoBack}
            language={language}
            onLanguageChange={handleLanguageChange}
            languageError={languageError}
            categories={selectableCategories}
            categoriesError={categoriesError}
            onRetryCategories={loadCategories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
          <Ionicons name={"close-circle-outline"} color={"white"} size={target.targetSize} style={[target.targetStyle, { opacity: 0.5 }]}/>
        </ImageBackground>
        {
          showModal &&
            <CenteredModal
              onPress={handleConfirmModal}
              onCancel={onCancelModal}
              isModalVisible={showModal}
              testIDPrefix="set-instructions.confirm-modal"
            >
              <ModalContent
                description={description}
                screenHeight={screenHeight}
                screenWidth={screenWidth}
                guessPath={false}
              />
            </CenteredModal>
        }
        {
          isTutorial &&
            <TutorialOverlay
              screen={"SetInstructionScreen"}
              isPortrait={isPortrait}
              instructionsPosition={{top:0, left: 0}}
            />
          }
      </View>
    </PrivateGroupThemeProvider>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    flex: 1,
  },
  targetStyle: {
    zIndex: -1,
  },
});
