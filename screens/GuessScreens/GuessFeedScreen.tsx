import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SwipeInstructions from '../../components/Instructions/SwipeInstructions';
import SwipeImage from '../../components/UI/SwipeImage';
import { LANGUAGES } from '../../constants/languages';
import {
  getOnboardingCompleted,
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../../utils/storageDatum';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useFlushOnLeave } from '../../hooks/useFlushOnLeave';
import { useAuthContext } from '../../store/auth-context';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import { handleOrientation } from '../../utils/orientation';

const DEFAULT_LANGUAGE = 'en';

const TEST_IDS = {
  currentLanguage: 'guess-feed.filter.language.current',
  languageFilter: 'guess-feed.filter.language',
  languageClose: 'guess-feed.filter.language.close',
};

type LanguageEntry = { code: string; name: string };

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

const languageOptionTestId = (code: string) => `guess-feed.filter.language.option.${code}`;

const resolveHiddenLocation = (item?: SwipeItem) => item?.hiddenLocation ?? item?.touchLocation;

// SwipeImage treats `category` and `language` as optional (defaults to 'all' / 'any').
// GuessFeedScreen is currently the only caller in the authenticated stack, but we
// still pass them explicitly so the cache namespace + filter plumbing stays explicit.
export default function GuessFeedScreen({ navigation, route }: GuessFeedScreenProps) {
  const authContext = useAuthContext();
  useFlushOnLeave({ navigation, authContext });
  const { category, language: routeLanguage, scope: routeScope, skipInstructions } = route.params || {};
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  // useScopedPrivateGroupTheme is a JS module with no exported types; narrow to local Theme.
  const { group, theme } = useScopedPrivateGroupTheme(routeScope) as {
    group: unknown;
    theme: Theme | null;
  };
  const [language, setLanguage] = useState<string | null>(routeLanguage || null);
  const [showOverlay, setShowOverlay] = useState(!skipInstructions);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

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

    loadLanguage();

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

  const handleSelectLanguage = async (code: string) => {
    await saveSessionLanguageFilter(code);
    setLanguage(code);
    setIsFilterModalVisible(false);
  };

  const activeLanguage = language ?? DEFAULT_LANGUAGE;

  const startGuessing = ({ item }: { item: SwipeItem }) => {
    navigation.navigate('GuessScreen', {
      ...route.params,
      ...item,
      hiddenLocation: resolveHiddenLocation(item),
      category,
      language: activeLanguage,
    });
  };

  if (!routeLanguage && language === null) {
    return (
      <Text style={styles.hiddenCurrent} testID={TEST_IDS.currentLanguage}>
        {DEFAULT_LANGUAGE}
      </Text>
    );
  }

  return (
    <PrivateGroupThemeProvider group={group}>
    <>
      <Text style={styles.hiddenCurrent} testID={TEST_IDS.currentLanguage}>
        {activeLanguage}
      </Text>

      {showOverlay ? (
        <SwipeInstructions
          screenWidth={screenWidth}
          handleFilterClick={() => setShowOverlay(false)}
        />
      ) : (
        <SwipeImage
          key={`${category?.key || 'all'}:${activeLanguage}`}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          startGuessing={startGuessing}
          category={category}
          language={activeLanguage}
          onOpenFilter={handleOpenFilter}
          scope={scope}
        />
      )}

      <Modal
        visible={isFilterModalVisible}
        onRequestClose={handleCloseFilter}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer} testID={TEST_IDS.languageFilter}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select language</Text>
            <Pressable
              onPress={handleCloseFilter}
              testID={TEST_IDS.languageClose}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {LANGUAGES.map((entry: LanguageEntry) => {
              const isSelected = entry.code === activeLanguage;

              return (
                <Pressable
                  key={entry.code}
                  onPress={() => handleSelectLanguage(entry.code)}
                  testID={languageOptionTestId(entry.code)}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {entry.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 15,
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  optionSelected: {
    backgroundColor: 'rgba(29, 19, 61, 0.08)',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
  },
});
