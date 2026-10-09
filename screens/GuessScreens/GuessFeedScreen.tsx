import { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SwipeInstructions from '../../components/Instructions/SwipeInstructions';
import SwipeImage from '../../components/UI/SwipeImage';
import LanguageSelector from '../../components/UI/LanguageSelector';
import ModeSelector from '../../components/UI/ModeSelector';
import {
  getOnboardingCompleted,
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
  getSessionModeFilter,
  saveSessionModeFilter,
} from '../../utils/storageDatum';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useFlushOnLeave } from '../../hooks/useFlushOnLeave';
import { useAuthContext } from '../../store/auth-context';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { handleOrientation } from '../../utils/orientation';

// Language namespace contract (I6): an unset filter means NO server filter.
// GuessPathScreen navigates with NAVIGATION_ANY_LANGUAGE ('any') when no stored
// pick exists, and resolveServerLanguage (cardDeck.ts) strips 'any' at the
// server boundary — mirroring getSessionLanguageFilter's "unset" sentinel
// (storageDatum.ts). A hard 'en' default here made every unset query hit
// `WHERE language = 'en'` against fr/null rows → empty feed until manual reload.
const DEFAULT_LANGUAGE = 'any';
const DEFAULT_MODE = 'any';

type Theme = {
  primaryColor?: string;
  headerTintColor?: string;
};

type SwipeItem = {
  hiddenLocation?: { x: number; y: number };
  touchLocation?: { x: number; y: number };
  [key: string]: unknown;
};

type GuessFeedRouteParams = {
  category?: { key?: string; id?: string };
  language?: string | null;
  mode?: string | null;
  skipInstructions?: boolean;
  scope?: { kind: 'private'; groupId: string } | { kind: 'public' };
  [key: string]: unknown;
};

type GuessFeedParamList = {
  GuessFeedScreen: GuessFeedRouteParams;
  GuessScreen: Record<string, unknown>;
};

type GuessFeedScreenProps = {
  navigation: NativeStackNavigationProp<GuessFeedParamList, 'GuessFeedScreen'>;
  route: RouteProp<GuessFeedParamList, 'GuessFeedScreen'>;
};

// SwipeImage treats `category` and `language` as optional (defaults to 'all' / 'any').
// GuessFeedScreen is currently the only caller in the authenticated stack, but we
// still pass them explicitly so the cache namespace + filter plumbing stays explicit.
export default function GuessFeedScreen({ navigation, route }: GuessFeedScreenProps) {
  const authContext = useAuthContext();
  useFlushOnLeave({ navigation, authContext });
  const { category, language: routeLanguage, mode: routeMode, skipInstructions } = route.params || {};
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  // useScopedPrivateGroupTheme is a JS module with no exported types; narrow to local Theme.
  const { group, theme } = useScopedPrivateGroupTheme(routeScope) as {
    group: unknown;
    theme: Theme | null;
  };
  const [language, setLanguage] = useState<string | null>(routeLanguage || null);
  const [mode, setMode] = useState<string | null>(routeMode || null);
  const [showOverlay, setShowOverlay] = useState(!skipInstructions);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isModeFilterModalVisible, setIsModeFilterModalVisible] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useFocusEffect(
    useCallback(() => {
      handleOrientation('portrait');
    }, [])
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLanguage() {
      if (routeLanguage) {
        setLanguage(routeLanguage);
        return;
      }

      const storedLanguage = await getSessionLanguageFilter();

      if (!cancelled && storedLanguage) {
        setLanguage(storedLanguage);
      } else if (!cancelled) {
        setLanguage(DEFAULT_LANGUAGE);
      }
    }

    async function loadMode() {
      if (routeMode) {
        setMode(routeMode);
        return;
      }

      const storedMode = await getSessionModeFilter();

      if (!cancelled && storedMode) {
        setMode(storedMode);
      } else if (!cancelled) {
        setMode(DEFAULT_MODE);
      }
    }

    loadLanguage();
    loadMode();

    return () => {
      cancelled = true;
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

  const handleOpenFilter = () => {
    setIsFilterModalVisible(true);
  };

  const handleCloseFilter = () => {
    setIsFilterModalVisible(false);
  };

  const handleOpenModeFilter = () => {
    setIsModeFilterModalVisible(true);
  };

  const handleCloseModeFilter = () => {
    setIsModeFilterModalVisible(false);
  };

  const handleSelectLanguage = async (code: string) => {
    await saveSessionLanguageFilter(code);
    setLanguage(code);
    setIsFilterModalVisible(false);
  };

  const handleSelectMode = async (filterMode: string) => {
    await saveSessionModeFilter(filterMode);
    setMode(filterMode);
    setIsModeFilterModalVisible(false);
  };

  const startGuessing = ({ item }: { item: SwipeItem }) => {
    navigation.navigate('GuessScreen', {
      ...route.params,
      ...item,
      hiddenLocation: item?.hiddenLocation ?? item?.touchLocation,
      category,
      language: language || DEFAULT_LANGUAGE,
      filterMode: mode || DEFAULT_MODE,
    });
  };

  if (!routeLanguage && language === null) {
    return (
      <>
        <Text style={styles.hiddenCurrent} testID="guess-feed.filter.language.current">
          {DEFAULT_LANGUAGE}
        </Text>
        <Text style={styles.hiddenCurrent} testID="guess-feed.filter.mode.current">
          {DEFAULT_MODE}
        </Text>
      </>
    );
  }

  return (
    <PrivateGroupThemeProvider group={group}>
    <>
      <Text style={styles.hiddenCurrent} testID="guess-feed.filter.language.current">
        {language || DEFAULT_LANGUAGE}
      </Text>
      <Text style={styles.hiddenCurrent} testID="guess-feed.filter.mode.current">
        {mode || DEFAULT_MODE}
      </Text>

      {showOverlay ? (
        <SwipeInstructions
          screenWidth={screenWidth}
          handleFilterClick={() => setShowOverlay(false)}
        />
      ) : (
        <SwipeImage
          key={`${category?.key || 'all'}:${language || 'any'}:${mode || 'any'}`}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          startGuessing={startGuessing}
          category={category}
          language={language || DEFAULT_LANGUAGE}
          mode={mode || DEFAULT_MODE}
          onOpenFilter={handleOpenFilter}
          onOpenModeFilter={handleOpenModeFilter}
          scope={scope}
        />
      )}

      <LanguageSelector
        value={language || DEFAULT_LANGUAGE}
        onChange={handleSelectLanguage}
        onClose={handleCloseFilter}
        testIDPrefix="guess-feed.filter.language"
        visible={isFilterModalVisible}
      />

      <ModeSelector
        value={mode || DEFAULT_MODE}
        onChange={handleSelectMode}
        onClose={handleCloseModeFilter}
        testIDPrefix="guess-feed.filter.mode"
        visible={isModeFilterModalVisible}
      />
    </>
    </PrivateGroupThemeProvider>
  );
}

const styles = StyleSheet.create({
  hiddenCurrent: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
