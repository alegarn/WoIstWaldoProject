import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ContextType, FC, ReactNode } from 'react';
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
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import GuessCategoryCard from '../../components/UI/GuessCategoryCard';
import TutorialOverlayDefault from '../../components/UI/TutorialOverlay';
import IconButtonDefault from '../../components/UI/IconButton';
import ButtonDefault from '../../components/UI/Button';
import CenteredModal from '../../components/UI/CenteredModal';
import LanguageSelector from '../../components/UI/LanguageSelector';
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

const DEFAULT_LANGUAGE = 'en';
const NAVIGATION_ANY_LANGUAGE = 'any';

type IconButtonProps = {
  icon: string;
  color?: string;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type ButtonProps = {
  children?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  thin?: boolean;
};

type TutorialOverlayProps = {
  screen?: string;
  instructionsPosition?: { top: number; left: number };
};

// IconButton.js/Button.js/TutorialOverlay.js are .js deps whose destructured
// (default-less) props TS infers as all-required; cast to the optional-prop
// shapes this screen actually passes — behavior preserved.
const IconButton = IconButtonDefault as unknown as FC<IconButtonProps>;
const Button = ButtonDefault as unknown as FC<ButtonProps>;
const TutorialOverlay = TutorialOverlayDefault as unknown as FC<TutorialOverlayProps>;

// Public scope carries no groupId; the optional-undefined keeps `scope?.groupId`
// honest at every access site without a discriminant dance.
type PublicScope = { kind: 'public'; groupId?: undefined };
type PrivateScope = { kind: 'private'; groupId: string };
type GuessPathScope = PrivateScope | PublicScope;

type GroupsHubGroup = {
  id?: string;
  role?: string;
  memberCount?: number;
  member_count?: number;
  locked?: boolean;
};

type GroupsHubData = {
  owned?: GroupsHubGroup[];
  joined?: GroupsHubGroup[];
};

type ActiveGroupSnapshot = {
  isOwnedByViewer: boolean;
  memberCount: number;
  locked: boolean;
};

type GuessPathCategory = {
  id?: string;
  key?: string;
  name: string;
  count?: number;
  thumbnail_image_id?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string | null;
};

type GuessPathRouteParams = {
  isTutorial?: boolean;
  scope?: PrivateScope;
};

type GuessPathNavigation = {
  navigate(name: 'GuessFeedScreen', params?: Record<string, unknown>): void;
  popToTop(): void;
  setOptions(options: { headerStyle?: { backgroundColor?: string }; headerTintColor?: string }): void;
};

type GuessPathScreenProps = {
  navigation: GuessPathNavigation;
  route?: { params?: GuessPathRouteParams };
};

type Theme = {
  primaryColor?: string;
  headerTintColor?: string;
};

type LateAttachState = {
  createdCategoryId: string | null;
  pendingImageId: string | null;
};

type AuthContextValue = ContextType<typeof AuthContext>;

function buildActiveGroupSnapshot(
  groupsHubData: GroupsHubData | null | undefined,
  groupId: string
): ActiveGroupSnapshot | null {
  const groups = [
    ...(groupsHubData?.owned ?? []),
    ...(groupsHubData?.joined ?? []),
  ];
  const activeGroup = groups.find(
    (group) => group?.id != null && String(group.id) === String(groupId)
  );

  if (!activeGroup) {
    return null;
  }

  return {
    isOwnedByViewer: activeGroup.role === 'owner',
    memberCount: Number(activeGroup.memberCount ?? activeGroup.member_count ?? 0),
    locked: activeGroup?.locked === true,
  };
}

async function resolveActiveGroupSnapshot({
  activeGroup,
  context,
  scope,
}: {
  activeGroup: ActiveGroupSnapshot | null;
  context: AuthContextValue;
  scope: GuessPathScope;
}): Promise<ActiveGroupSnapshot | null> {
  if (activeGroup || scope?.kind !== 'private') {
    return activeGroup;
  }

  const response = await fetchGroups(context);
  if (response?.status !== 200) {
    return null;
  }

  return buildActiveGroupSnapshot(response.data, scope.groupId);
}

export default function GuessPathScreen({ navigation, route }: GuessPathScreenProps) {
  const { t } = useTranslation();
  const context = useContext(AuthContext);
  const [categories, setCategories] = useState<GuessPathCategory[]>([]);
  const [sessionLanguage, setSessionLanguage] = useState<string | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isAddCategoryVisible, setIsAddCategoryVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [newCategoryThumbnailImageId, setNewCategoryThumbnailImageId] = useState<string | null>(null);
  const [isPickingCreateThumbnail, setIsPickingCreateThumbnail] = useState(false);
  const [manageMode, setManageMode] = useState<'update' | 'delete' | null>(null);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const lateAttachRef = useRef<LateAttachState>({ createdCategoryId: null, pendingImageId: null });

  const isTutorial = route?.params?.isTutorial;
  const routeScope = route?.params?.scope;
  // useActiveGroup.js is untyped JS returning the same scope union; keep the cast local.
  const { scope: activeScope } = useActiveGroup() as { scope: GuessPathScope };
  const scope: GuessPathScope = routeScope ?? activeScope;
  const isPrivateScope = scope?.kind === 'private' && !!scope?.groupId;
  // hooks/useGroupsHub.ts is typed TS; data is GroupsHubData | null from the groups hub.
  const { data: groupsHubData, refresh: refreshGroupsHub } = useGroupsHub({ enabled: isPrivateScope }) as {
    data: GroupsHubData | null;
    refresh: () => Promise<void>;
  };
  const activeGroup = isPrivateScope ? buildActiveGroupSnapshot(groupsHubData, scope.groupId) : null;
  const isOwner = activeGroup?.isOwnedByViewer === true;
  // useScopedPrivateGroupTheme.js is untyped JS; narrow to the local structural shapes.
  const { group, theme } = useScopedPrivateGroupTheme(routeScope) as {
    group: GroupsHubGroup | null;
    theme: Theme | null;
  };
  const isGroupLocked = isPrivateScope && group?.locked === true;

  const enrichAndSetPrivateCategories = useCallback(async (nextCategories: GuessPathCategory[]) => {
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
      refreshGroupsHub();
    }, [reloadCategories, refreshGroupsHub])
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

  const handleCategoryPress = async (category: GuessPathCategory) => {
    if (isPrivateScope && isGroupLocked) {
      Alert.alert(
        t('guess.path.lockTitle'),
        t('guess.path.lockMessage')
      );
      return;
    }

    const params: {
      category: GuessPathCategory;
      language: string;
      scope?: GuessPathScope;
      activeGroup?: ActiveGroupSnapshot | null;
    } = {
      category,
      language: navigationLanguage,
    };

    if (isPrivateScope) {
      const resolvedActiveGroup = await resolveActiveGroupSnapshot({
        activeGroup,
        context,
        scope,
      });
      if (resolvedActiveGroup?.locked) {
        Alert.alert(
          t('guess.path.lockTitle'),
          t('guess.path.lockMessage')
        );
        return;
      }
      params.scope = scope;
      params.activeGroup = resolvedActiveGroup;
    }

    navigation.navigate('GuessFeedScreen', params);
  };

  const handleSelectLanguage = async (code: string) => {
    await saveSessionLanguageFilter(code);
    setSessionLanguage(code);
    setIsFilterModalVisible(false);
  };

  const handleOpenAddCategory = () => {
    setNewCategoryName('');
    setNewCategoryThumbnailImageId(null);
    lateAttachRef.current = { createdCategoryId: null, pendingImageId: null };
    setIsAddCategoryVisible(true);
  };

  const handleCloseAddCategory = () => {
    setIsAddCategoryVisible(false);
    setNewCategoryName('');
    setNewCategoryThumbnailImageId(null);
  };

  // Late-attach fallback: PATCH only when create went out without a thumbnail id —
  // update_category destroys the replaced thumbnail row, so never re-attach.
  const tryLateAttachThumbnail = async () => {
    const { createdCategoryId, pendingImageId } = lateAttachRef.current;
    if (!createdCategoryId || !pendingImageId) {
      return;
    }
    lateAttachRef.current = { createdCategoryId: null, pendingImageId: null };
    try {
      const response = await updateGroupCategory(context, scope.groupId, createdCategoryId, {
        thumbnailImageId: pendingImageId,
      });
      if (response?.status === 200 || response?.status === 204) {
        await reloadCategories();
      } else {
        Alert.alert(t('common.error'), t('guess.path.updateThumbnailFailed'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as { message?: string })?.message ?? t('guess.path.updateThumbnailFailed'));
    }
  };

  const handleCreateCategory = async () => {
    if (isCreatingCategory) {
      return;
    }
    if (isPickingCreateThumbnail) {
      return;
    }
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      return;
    }
    setIsCreatingCategory(true);
    const hasThumbnail = newCategoryThumbnailImageId != null;
    const thumbnailImageId = hasThumbnail ? newCategoryThumbnailImageId : undefined;
    const response = await createGroupCategory(context, scope.groupId, {
      name: trimmed,
      thumbnailImageId,
    });
    setIsCreatingCategory(false);
    if (response?.status === 200 || response?.status === 201) {
      setIsAddCategoryVisible(false);
      setNewCategoryName('');
      setNewCategoryThumbnailImageId(null);
      if (!hasThumbnail) {
        lateAttachRef.current = {
          ...lateAttachRef.current,
          createdCategoryId: response?.data?.id ?? null,
        };
        await tryLateAttachThumbnail();
      }
      await reloadCategories();
    } else {
      Alert.alert(t('common.error'), t('guess.path.createCategoryFailed'));
    }
  };

  const handlePickCreateThumbnail = async () => {
    if (isPickingCreateThumbnail) {
      return;
    }
    setIsPickingCreateThumbnail(true);
    try {
      // Pick affordances render only for owners in private scope; groupId is a
      // string whenever this handler can run.
      const uploaded = await uploadCategoryThumbnail({ context, groupId: scope.groupId as string });
      if (uploaded) {
        setNewCategoryThumbnailImageId(uploaded.imageId);
        lateAttachRef.current = {
          ...lateAttachRef.current,
          pendingImageId: uploaded.imageId,
        };
        await tryLateAttachThumbnail();
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as { message?: string })?.message ?? t('guess.path.pickThumbnailFailed'));
    } finally {
      setIsPickingCreateThumbnail(false);
    }
  };

  // Per-card thumbnail swap from the grid (owner only). Old local cache file purged
  // before the PATCH so a failed update does not leave stale bytes for the new imageId.
  const handleEditCategoryThumbnail = async (category: GuessPathCategory) => {
    try {
      // Same private-scope-only invariant as handlePickCreateThumbnail.
      const uploaded = await uploadCategoryThumbnail({ context, groupId: scope.groupId as string });
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
        Alert.alert(t('common.error'), t('guess.path.updateThumbnailFailed'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as { message?: string })?.message ?? t('guess.path.updateThumbnailFailed'));
    }
  };

  const handleDeleteCategory = async (item: GuessPathCategory) => {
    Alert.alert(
      t('guess.path.deleteCategoryTitle'),
      t('guess.path.deleteCategoryMessage', { name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
                Alert.alert(t('guess.path.deleteFailedStatus', { status: response?.status ?? '' }), t('guess.path.deleteCategoryFailed'));
              }
            } finally {
              setIsDeletingCategory(false);
            }
          },
        },
      ],
    );
  };

  const gridData: GuessPathCategory[] = [RECENT_ALL_CATEGORY, ...categories];

  return (
    <PrivateGroupThemeProvider group={group}>
    <>
      {isE2EMode() && (
        <Pressable
          accessibilityLabel={t('guess.path.returnHome')}
          accessibilityRole="button"
          onPress={() => navigation.popToTop()}
          style={styles.e2eHomeButton}
          testID="guess-path.button.home"
        >
          <Text style={styles.e2eHomeButtonText}>{t('common.home')}</Text>
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
                accessibilityLabel={t('guess.path.addCategory')}
              />
            )}
            {isOwner && (
              <IconButton
                icon="options-outline"
                color="GlobalStyle.color.tertiaryColor900"
                size={24}
                onPress={() => setIsManageModalVisible(true)}
                testID="guess-path.button.manage"
                accessibilityLabel={t('guess.path.manageCategories')}
              />
            )}
            <IconButton
              icon="ellipsis-horizontal"
              color="GlobalStyle.color.tertiaryColor900"
              size={24}
              onPress={() => setIsFilterModalVisible(true)}
              testID="guess-path.button.details"
              accessibilityLabel={t('guess.path.openLanguageFilter')}
            />
          </View>
        </View>
        {manageMode !== null && (
          <View style={styles.manageBanner}>
            <Text style={styles.manageBannerText}>
              {manageMode === 'update' ? t('guess.path.updatingImages') : t('guess.path.deletingCategories')}
            </Text>
            <Button
              onPress={() => setManageMode(null)}
              testID="guess-path.button.manage-done"
              accessibilityLabel={t('guess.path.doneManaging')}
              thin={true}
            >
              {t('common.done')}
            </Button>
          </View>
        )}
        <FlatList
          data={gridData}
          extraData={navigationLanguage}
          numColumns={2}
          keyExtractor={(item) => (item.key ?? item.id) as string}
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
                  accessibilityLabel={t('guess.path.editThumbnailLabel', { name: item.name })}
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
                  accessibilityLabel={t('guess.path.deleteCategoryLabel', { name: item.name })}
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

      <LanguageSelector
        value={resolvedLanguage}
        onChange={handleSelectLanguage}
        onClose={() => setIsFilterModalVisible(false)}
        testIDPrefix="guess-path.filter.language"
        visible={isFilterModalVisible}
      />

      <CenteredModal
        isModalVisible={isAddCategoryVisible}
        onCancel={handleCloseAddCategory}
        onPress={handleCreateCategory}
        testIDPrefix="guess-path.add-category"
        confirmTestID="guess-path.add-category.button.create"
        cancelTestID="guess-path.add-category.button.cancel"
        confirmLabel={isCreatingCategory ? t('common.creating') : t('common.create')}
        cancelLabel={t('common.cancel')}
        confirmDisabled={isPickingCreateThumbnail}
      >
        <View style={styles.addCategoryBody}>
          <TextInput
            testID="guess-path.add-category.input.name"
            accessibilityLabel={t('guess.path.newCategoryName')}
            placeholder={t('guess.path.newCategoryPlaceholder')}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            editable={!isCreatingCategory}
            style={styles.categoryInput}
          />
          <Button
            onPress={handlePickCreateThumbnail}
            testID="guess-path.add-category.button.pick-thumbnail"
            accessibilityLabel={t('guess.path.pickThumbnailLabel')}
            disabled={isPickingCreateThumbnail || isCreatingCategory}
            thin={true}
          >
            {newCategoryThumbnailImageId ? t('guess.path.thumbnailReady') : t('guess.path.addThumbnailOptional')}
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
            <Text style={styles.modalTitle}>{t('guess.path.manageCategories')}</Text>
            <Pressable
              onPress={() => setIsManageModalVisible(false)}
              testID="guess-path.manage.close"
              accessibilityRole="button"
              accessibilityLabel={t('guess.path.closeManageCategories')}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
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
              accessibilityLabel={t('guess.path.updateCategoryImages')}
              style={styles.option}
            >
              <Text style={styles.optionText}>{t('guess.path.updateImages')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setManageMode('delete');
                setIsManageModalVisible(false);
              }}
              testID="guess-path.manage.option.delete"
              accessibilityRole="button"
              accessibilityLabel={t('guess.path.deleteCategories')}
              style={styles.option}
            >
              <Text style={styles.optionText}>{t('guess.path.deleteCategories')}</Text>
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
  optionText: {
    fontSize: 16,
    color: '#333',
  },
});
