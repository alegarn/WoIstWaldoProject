import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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

// SwipeImage treats `category` and `language` as optional (defaults to 'all' / 'any').
// GuessFeedScreen is currently the only caller in the authenticated stack, but we
// still pass them explicitly so the cache namespace + filter plumbing stays explicit.
export default function GuessFeedScreen({ navigation, route }) {
  const authContext = useAuthContext();
  useFlushOnLeave({ navigation, authContext });
  const { category, language: routeLanguage, skipInstructions } = route.params || {};
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const { group, theme } = useScopedPrivateGroupTheme(routeScope);
  const [language, setLanguage] = useState(routeLanguage || null);
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

  const handleSelectLanguage = async (code) => {
    await saveSessionLanguageFilter(code);
    setLanguage(code);
    setIsFilterModalVisible(false);
  };

  const startGuessing = ({ item }) => {
    navigation.navigate('GuessScreen', {
      ...route.params,
      ...item,
      hiddenLocation: item?.hiddenLocation ?? item?.touchLocation,
      category,
      language: language || DEFAULT_LANGUAGE,
    });
  };

  if (!routeLanguage && language === null) {
    return (
      <Text style={styles.hiddenCurrent} testID="guess-feed.filter.language.current">
        {DEFAULT_LANGUAGE}
      </Text>
    );
  }

  return (
    <PrivateGroupThemeProvider group={group}>
    <>
      <Text style={styles.hiddenCurrent} testID="guess-feed.filter.language.current">
        {language || DEFAULT_LANGUAGE}
      </Text>

      {showOverlay ? (
        <SwipeInstructions
          screenWidth={screenWidth}
          handleFilterClick={() => setShowOverlay(false)}
        />
      ) : (
        <SwipeImage
          key={`${category?.key || 'all'}:${language || 'any'}`}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          startGuessing={startGuessing}
          category={category}
          language={language || DEFAULT_LANGUAGE}
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
        <View style={styles.modalContainer} testID="guess-feed.filter.language">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select language</Text>
            <Pressable
              onPress={handleCloseFilter}
              testID="guess-feed.filter.language.close"
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {LANGUAGES.map((entry) => {
              const isSelected = entry.code === (language || DEFAULT_LANGUAGE);

              return (
                <Pressable
                  key={entry.code}
                  onPress={() => handleSelectLanguage(entry.code)}
                  testID={`guess-feed.filter.language.option.${entry.code}`}
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
