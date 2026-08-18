import { useCallback, useContext, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlobalStyle } from '../../constants/theme';
import GuessCategoryCard from '../../components/UI/GuessCategoryCard';
import TutorialOverlay from '../../components/UI/TutorialOverlay';
import IconButton from '../../components/UI/IconButton';
import Button from '../../components/UI/Button';
import CenteredModal from '../../components/UI/CenteredModal';
import { LANGUAGES } from '../../constants/languages';
import { getDefaultCategories } from '../../constants/defaultCategories';
import { getCategories } from '../../utils/categoryRequests';
import {
  getPreferredLanguage,
  getSessionLanguageFilter,
  saveSessionLanguageFilter,
} from '../../utils/storageDatum';
import { isE2EMode } from '../../utils/e2eMode';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { AuthContext } from '../../store/auth-context';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';
import {
  createGroupCategory,
  deleteGroupCategory,
  updateGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import { loadGroupCategoriesOptimistic } from '../../services/groups/groupCategoriesStore';
import {
  resolveCategoryThumbnail,
  deleteCategoryThumbnailFile,
} from '../../services/groups/groupCategoryThumbnails';
import { uploadCategoryThumbnail } from '../../services/groups/categoryThumbnailUpload';
import { fetchGroups } from '../../services/groups/groupApi';

import { RECENT_ALL_CATEGORY } from '../../constants/categories';
export { RECENT_ALL_CATEGORY };

const DEFAULT_LANGUAGE = 'en';
const NAVIGATION_ANY_LANGUAGE = 'any';

function buildActiveGroupSnapshot(groupsHubData, groupId) {
  const groups = [
    ...(groupsHubData?.owned ?? []),
    ...(groupsHubData?.joined ?? []),
  ];
  const activeGroup = groups.find((group) => group?.id === groupId);

  if (!activeGroup) {
    return null;
  }

  return {
    isOwnedByViewer: activeGroup.role === 'owner',
    memberCount: Number(activeGroup.memberCount ?? activeGroup.member_count ?? 0),
  };
}

async function resolveActiveGroupSnapshot({ activeGroup, context, scope }) {
  if (activeGroup || scope?.kind !== 'private') {
    return activeGroup;
  }

  const response = await fetchGroups(context);
  if (response?.status !== 200) {
    return null;
  }

  return buildActiveGroupSnapshot(response.data, scope.groupId);
}

export default function GuessPathScreen({ navigation, route }) {
  const context = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [sessionLanguage, setSessionLanguage] = useState(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isAddCategoryVisible, setIsAddCategoryVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [newCategoryThumbnailImageId, setNewCategoryThumbnailImageId] = useState(null);
  const [isPickingCreateThumbnail, setIsPickingCreateThumbnail] = useState(false);
  const [manageMode, setManageMode] = useState(null);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);

  const isTutorial = route?.params?.isTutorial;
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const isPrivateScope = scope?.kind === 'private' && !!scope?.groupId;
  const { data: groupsHubData } = useGroupsHub({ enabled: isPrivateScope });
  const activeGroup = isPrivateScope ? buildActiveGroupSnapshot(groupsHubData, scope.groupId) : null;
  const isOwner = activeGroup?.isOwnedByViewer === true;
  const { group, theme } = useScopedPrivateGroupTheme(routeScope);

  const enrichAndSetPrivateCategories = useCallback(async (nextCategories) => {
    const list = Array.isArray(nextCategories) ? nextCategories : [];
    const resolvedThumbnailUrls = await Promise.all(
      list.map((category) => (
        category?.thumbnail_image_id
          ? resolveCategoryThumbnail(context, {
            groupId: scope.groupId,
            category,
          })
          : Promise.resolve(null)
      ))
    );

    setCategories(list.map((category, index) => ({
      ...category,
      thumbnailUrl: resolvedThumbnailUrls[index]
        ?? category?.thumbnailUrl
        ?? category?.thumbnail_url
        ?? null,
    })));
  }, [context, scope?.groupId]);

  const reloadCategories = useCallback(async () => {
    if (isPrivateScope) {
      await loadGroupCategoriesOptimistic({
        context,
        groupId: scope.groupId,
        onCategories: enrichAndSetPrivateCategories,
      });
      return;
    }

    if (isE2EMode()) {
      const response = await getCategories({ context });
      setCategories(response?.data ?? []);
      return;
    }

    setCategories(getDefaultCategories().data);
  }, [context, isPrivateScope, scope?.groupId, enrichAndSetPrivateCategories]);

  useFocusEffect(
    useCallback(() => {
      setManageMode(null);
      reloadCategories();
    }, [reloadCategories])
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLanguage() {
      const [stored, preferred] = await Promise.all([
        getSessionLanguageFilter(),
        getPreferredLanguage(),
      ]);
      if (cancelled) {
        return;
      }
      setSessionLanguage(stored ?? preferred ?? null);
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

  const resolvedLanguage = sessionLanguage ?? DEFAULT_LANGUAGE;
  const navigationLanguage = sessionLanguage ?? NAVIGATION_ANY_LANGUAGE;

  const handleCategoryPress = async (category) => {
    const params = {
      category,
      language: navigationLanguage,
    };

    if (isPrivateScope) {
      const resolvedActiveGroup = await resolveActiveGroupSnapshot({
        activeGroup,
        context,
        scope,
      });
      params.scope = scope;
      params.activeGroup = resolvedActiveGroup;
    }

    navigation.navigate('GuessFeedScreen', params);
  };

  const handleSelectLanguage = async (code) => {
    await saveSessionLanguageFilter(code);
    setSessionLanguage(code);
    setIsFilterModalVisible(false);
  };

  const handleOpenAddCategory = () => {
    setNewCategoryName('');
    setNewCategoryThumbnailImageId(null);
    setIsAddCategoryVisible(true);
  };

  const handleCloseAddCategory = () => {
    setIsAddCategoryVisible(false);
    setNewCategoryName('');
    setNewCategoryThumbnailImageId(null);
  };

  const handleCreateCategory = async () => {
    if (isCreatingCategory) {
      return;
    }
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      return;
    }
    setIsCreatingCategory(true);
    const response = await createGroupCategory(context, scope.groupId, {
      name: trimmed,
      thumbnailImageId: newCategoryThumbnailImageId ?? undefined,
    });
    setIsCreatingCategory(false);
    if (response?.status === 200 || response?.status === 201) {
      setIsAddCategoryVisible(false);
      setNewCategoryName('');
      setNewCategoryThumbnailImageId(null);
      await reloadCategories();
    } else {
      Alert.alert('Error', 'Could not create category.');
    }
  };

  const handlePickCreateThumbnail = async () => {
    if (isPickingCreateThumbnail) {
      return;
    }
    setIsPickingCreateThumbnail(true);
    try {
      const uploaded = await uploadCategoryThumbnail({ context, groupId: scope.groupId });
      if (uploaded) {
        setNewCategoryThumbnailImageId(uploaded.imageId);
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not pick thumbnail.');
    } finally {
      setIsPickingCreateThumbnail(false);
    }
  };

  // Per-card thumbnail swap from the grid (owner only). Old local cache file purged
  // before the PATCH so a failed update does not leave stale bytes for the new imageId.
  const handleEditCategoryThumbnail = async (category) => {
    try {
      const uploaded = await uploadCategoryThumbnail({ context, groupId: scope.groupId });
      if (!uploaded) {
        return;
      }
      if (category.thumbnail_image_id) {
        deleteCategoryThumbnailFile(scope.groupId, category.thumbnail_image_id);
      }
      const response = await updateGroupCategory(context, scope.groupId, category.id, {
        thumbnailImageId: uploaded.imageId,
      });
      if (response?.status === 200 || response?.status === 204) {
        await reloadCategories();
      } else {
        Alert.alert('Error', 'Could not update thumbnail.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not update thumbnail.');
    }
  };

  const handleDeleteCategory = async (item) => {
    Alert.alert(
      'Delete category?',
      `"${item.name}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isDeletingCategory) {
              return;
            }
            setIsDeletingCategory(true);
            try {
              const response = await deleteGroupCategory(context, scope.groupId, item.id);
              if (response?.status === 200 || response?.status === 204) {
                if (item.thumbnail_image_id) {
                  deleteCategoryThumbnailFile(scope.groupId, item.thumbnail_image_id);
                }
                await reloadCategories();
              } else {
                Alert.alert(`Error ${response?.status ?? ''}`, 'Could not delete category.');
              }
            } finally {
              setIsDeletingCategory(false);
            }
          },
        },
      ],
    );
  };

  const gridData = [RECENT_ALL_CATEGORY, ...categories];

  return (
    <PrivateGroupThemeProvider group={group}>
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
          <View style={styles.headerActions}>
            {isOwner && (
              <IconButton
                icon="add-circle-outline"
                color="GlobalStyle.color.tertiaryColor900"
                size={24}
                onPress={handleOpenAddCategory}
                testID="guess-path.button.add-category"
                accessibilityLabel="Add category"
              />
            )}
            {isOwner && (
              <IconButton
                icon="options-outline"
                color="GlobalStyle.color.tertiaryColor900"
                size={24}
                onPress={() => setIsManageModalVisible(true)}
                testID="guess-path.button.manage"
                accessibilityLabel="Manage categories"
              />
            )}
            <IconButton
              icon="ellipsis-horizontal"
              color="GlobalStyle.color.tertiaryColor900"
              size={24}
              onPress={() => setIsFilterModalVisible(true)}
              testID="guess-path.button.details"
              accessibilityLabel="Open language filter"
            />
          </View>
        </View>
        {manageMode !== null && (
          <View style={styles.manageBanner}>
            <Text style={styles.manageBannerText}>
              {manageMode === 'update' ? 'Updating images' : 'Deleting categories'}
            </Text>
            <Button
              onPress={() => setManageMode(null)}
              testID="guess-path.button.manage-done"
              accessibilityLabel="Done managing"
              thin={true}
            >
              Done
            </Button>
          </View>
        )}
        <FlatList
          data={gridData}
          extraData={navigationLanguage}
          numColumns={2}
          keyExtractor={(item) => item.key ?? item.id}
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
              {isOwner && item.id !== 'all' && manageMode === 'update' && (
                <IconButton
                  icon="create-outline"
                  color="#FFFFFF"
                  size={18}
                  onPress={() => handleEditCategoryThumbnail(item)}
                  testID={`guess-path.category.edit.${item.id}`}
                  accessibilityLabel={`Edit ${item.name} thumbnail`}
                  style={styles.cardEditButton}
                />
              )}
              {isOwner && item.id !== 'all' && manageMode === 'delete' && (
                <IconButton
                  icon="trash-outline"
                  color="#FF3B30"
                  size={18}
                  onPress={() => handleDeleteCategory(item)}
                  disabled={isDeletingCategory}
                  testID={`guess-path.category.delete.${item.id}`}
                  accessibilityLabel={`Delete ${item.name}`}
                  style={styles.cardEditButton}
                />
              )}
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

      <CenteredModal
        isModalVisible={isAddCategoryVisible}
        onCancel={handleCloseAddCategory}
        onPress={handleCreateCategory}
        testIDPrefix="guess-path.add-category"
        confirmTestID="guess-path.add-category.button.create"
        cancelTestID="guess-path.add-category.button.cancel"
        confirmLabel={isCreatingCategory ? 'Creating...' : 'Create'}
        cancelLabel="Cancel"
      >
        <View style={styles.addCategoryBody}>
          <TextInput
            testID="guess-path.add-category.input.name"
            accessibilityLabel="New category name"
            placeholder="New category"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            editable={!isCreatingCategory}
            style={styles.categoryInput}
          />
          <Button
            onPress={handlePickCreateThumbnail}
            testID="guess-path.add-category.button.pick-thumbnail"
            accessibilityLabel="Pick category thumbnail"
            disabled={isPickingCreateThumbnail || isCreatingCategory}
            thin={true}
          >
            {newCategoryThumbnailImageId ? 'Thumbnail ready' : 'Add thumbnail (optional)'}
          </Button>
        </View>
      </CenteredModal>

      <Modal
        visible={isManageModalVisible}
        onRequestClose={() => setIsManageModalVisible(false)}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer} testID="guess-path.manage">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage categories</Text>
            <Pressable
              onPress={() => setIsManageModalVisible(false)}
              testID="guess-path.manage.close"
              accessibilityRole="button"
              accessibilityLabel="Close manage categories"
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable
              onPress={() => {
                setManageMode('update');
                setIsManageModalVisible(false);
              }}
              testID="guess-path.manage.option.update"
              accessibilityRole="button"
              accessibilityLabel="Update category images"
              style={styles.option}
            >
              <Text style={styles.optionText}>Update images</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setManageMode('delete');
                setIsManageModalVisible(false);
              }}
              testID="guess-path.manage.option.delete"
              accessibilityRole="button"
              accessibilityLabel="Delete categories"
              style={styles.option}
            >
              <Text style={styles.optionText}>Delete categories</Text>
            </Pressable>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(29, 19, 61, 0.08)',
  },
  manageBannerText: {
    fontSize: 14,
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  categoryInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    padding: 10,
    minWidth: 200,
    color: '#000',
  },
  addCategoryBody: {
    gap: 10,
    minWidth: 200,
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
    position: 'relative',
  },
  cardEditButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
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
