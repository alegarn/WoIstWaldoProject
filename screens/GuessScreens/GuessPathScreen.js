import { useContext, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import GuessCategoryCard from '../../components/UI/GuessCategoryCard';
import TutorialOverlay from '../../components/UI/TutorialOverlay';
import IconButton from '../../components/UI/IconButton';
import { LANGUAGES } from '../../constants/languages';
import { getCategories } from '../../utils/categoryRequests';
import {
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../../utils/storageDatum';
import { isE2EMode } from '../../utils/e2eMode';
import { AuthContext } from '../../store/auth-context';

const RECENT_ALL_CATEGORY = {
  id: 'all',
  key: 'all',
  name: 'Recent/All',
  count: undefined,
};

const DEFAULT_LANGUAGE = 'en';
const NAVIGATION_ANY_LANGUAGE = 'any';

export default function GuessPathScreen({ navigation, route }) {
  const context = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [sessionLanguage, setSessionLanguage] = useState(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const isTutorial = route?.params?.isTutorial;

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      const response = await getCategories({ context });
      if (cancelled) {
        return;
      }
      if (response?.data) {
        setCategories(response.data);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [context]);

  useEffect(() => {
    let cancelled = false;

    async function loadLanguage() {
      const stored = await getSessionLanguageFilter();
      if (cancelled) {
        return;
      }
      setSessionLanguage(stored);
    }

    loadLanguage();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedLanguage = sessionLanguage ?? DEFAULT_LANGUAGE;
  const navigationLanguage = sessionLanguage ?? NAVIGATION_ANY_LANGUAGE;

  const handleCategoryPress = (category) => {
    navigation.navigate('GuessFeedScreen', {
      category,
      language: navigationLanguage,
    });
  };

  const handleSelectLanguage = async (code) => {
    await saveSessionLanguageFilter(code);
    setSessionLanguage(code);
    setIsFilterModalVisible(false);
  };

  const gridData = [RECENT_ALL_CATEGORY, ...categories];

  return (
    <>
      {isE2EMode() && (
        <Pressable
          accessibilityLabel="Return to home"
          accessibilityRole="button"
          onPress={() => navigation.popToTop()}
          style={styles.e2eHomeButton}
          testID="guess-path.button.home"
        >
          <Text style={styles.e2eHomeButtonText}>Home</Text>
        </Pressable>
      )}

      <Text style={styles.hiddenCurrent} testID="guess-path.filter.language.current">
        {resolvedLanguage}
      </Text>

      <View style={styles.gridContainer}>
        <View style={styles.header}>
          <IconButton
            icon="ellipsis-horizontal"
            color="GlobalStyle.color.tertiaryColor900"
            size={24}
            onPress={() => setIsFilterModalVisible(true)}
            testID="guess-path.button.details"
            accessibilityLabel="Open language filter"
          />
        </View>
        <FlatList
          data={gridData}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          testID="guess-path.category.grid"
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <GuessCategoryCard
                category={{ ...item, id: item.key }}
                thumbnailUrl={item.thumbnailUrl}
                count={item.count}
                onPress={() => handleCategoryPress(item)}
                testIDPrefix="guess-path.category"
              />
            </View>
          )}
        />
      </View>

      {isTutorial && (
        <TutorialOverlay
          screen={"GuessPathScreen"}
          instructionsPosition={{ top: 0, left: 0 }}
        />
      )}

      <Modal
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer} testID="guess-path.filter.language">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select language</Text>
            <Pressable
              onPress={() => setIsFilterModalVisible(false)}
              testID="guess-path.filter.language.close"
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {LANGUAGES.map((language) => {
              const isSelected = language.code === resolvedLanguage;
              return (
                <Pressable
                  key={language.code}
                  onPress={() => handleSelectLanguage(language.code)}
                  testID={`guess-path.filter.language.option.${language.code}`}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {language.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hiddenCurrent: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  e2eHomeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(29, 19, 61, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  e2eHomeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  gridContainer: {
    flex: 1,
    backgroundColor: '#F4F0E8',
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gridContent: {
    padding: 12,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
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
