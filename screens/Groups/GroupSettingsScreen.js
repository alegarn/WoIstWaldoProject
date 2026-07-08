import { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Alert, Image, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import BigButton from '../../components/UI/BigButton';
import ColorPalettePicker from '../../components/UI/ColorPalettePicker';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { AuthContext } from '../../store/auth-context';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { updateGroupSettings } from '../../services/groups/groupApi';
import {
  listGroupCategories,
  createGroupCategory,
  updateGroupCategory,
  deleteGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import { deleteCategoryThumbnailFile, resolveCategoryThumbnail } from '../../services/groups/groupCategoryThumbnails';
import { preparePrivateUpload } from '../../services/groups/groupUploadApi';
import { performImageUpload } from '../../utils/imagesRequests';
import { uploadCategoryThumbnail } from '../../services/groups/categoryThumbnailUpload';

const UI_KINDS = [
  { kind: 'home-background', flag: 'isHomeBackground', label: 'Home background' },
  { kind: 'button-background', flag: 'isButtonBackground', label: 'Button background' },
  { kind: 'button-image', flag: 'isButtonImage', label: 'Button image' },
];

export default function GroupSettingsScreen({ navigation }) {
  const authContext = useContext(AuthContext);
  const { scope } = useActiveGroup();
  const { data, isLoading, refresh } = useGroupsHub();

  const groupId = scope?.kind === 'private' ? scope.groupId : null;
  const groups = [...(data?.owned ?? []), ...(data?.joined ?? [])];
  const group = groups.find((g) => g.id === groupId) ?? null;
  const isOwner = group?.role === 'owner';

  const [name, setName] = useState(group?.name ?? '');
  const [primaryColor, setPrimaryColor] = useState(group?.primary_color ?? GlobalStyle.color.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(group?.secondary_color ?? GlobalStyle.color.secondaryColor);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activeUploadKind, setActiveUploadKind] = useState(null);
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [thumbnailUris, setThumbnailUris] = useState({});

  useEffect(() => {
    if (group) {
      setName(group.name ?? '');
      setPrimaryColor(group.primary_color ?? GlobalStyle.color.primaryColor);
      setSecondaryColor(group.secondary_color ?? GlobalStyle.color.secondaryColor);
    }
  }, [group]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const loadCategories = useCallback(async () => {
    if (!groupId) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    const response = await listGroupCategories(authContext, groupId);
    setCategoriesLoading(false);
    if (response?.status === 200) {
      const nextCategories = response.data ?? [];
      setCategories(nextCategories);
      setCategoryDrafts(
        nextCategories.reduce((accumulator, category) => {
          accumulator[category.id] = category.name ?? '';
          return accumulator;
        }, {}),
      );
      const resolved = await Promise.all(
        nextCategories.map((category) => (
          category?.thumbnail_image_id
            ? resolveCategoryThumbnail(authContext, { groupId, category })
            : Promise.resolve(null)
        )),
      );
      setThumbnailUris(
        nextCategories.reduce((accumulator, category, index) => {
          accumulator[category.id] = resolved[index];
          return accumulator;
        }, {}),
      );
    } else {
      setCategoriesError(response?.data ?? 'Could not load categories.');
    }
  }, [authContext, groupId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!groupId) return;
    if (isLoading) return;
    if (isOwner) return;
    navigation.replace('GroupsListScreen');
  }, [groupId, isOwner, isLoading, navigation]);

  if (!groupId || isLoading || !isOwner) {
    return <LoadingOverlay message="Checking ownership..." />;
  }

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await updateGroupSettings(authContext, groupId, {
        name: name.trim(),
        primaryColor,
        secondaryColor,
      });
      if (response?.status === 200 || response?.status === 204) {
        Alert.alert('Saved', 'Group settings updated.');
        refresh();
      } else {
        Alert.alert(`Error ${response?.status ?? ''}`, 'Could not save settings.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const pickAndUpload = async (uiKind) => {
    setActiveUploadKind(uiKind.kind);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 0.5,
      });
      if (result?.canceled || !result?.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const fileExtension = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const presignResponse = await preparePrivateUpload({
        context: authContext,
        groupId,
        kind: uiKind.kind,
        fileExtension,
        contentType: `image/${fileExtension}`,
        contentLength: asset.fileSize ?? 0,
        [uiKind.flag]: true,
      });
      if (presignResponse?.status !== 200 && presignResponse?.status !== 201) {
        Alert.alert(`Error ${presignResponse?.status ?? ''}`, 'Could not prepare upload.');
        return;
      }
      const uploadPlan = presignResponse.data;
      const uploadResponse = await performImageUpload({
        plan: uploadPlan,
        fileUrl: asset.uri,
        fileExtension,
        contentLength: asset.fileSize ?? 0,
        context: authContext,
      });
      if (uploadResponse?.status === 200 || uploadResponse?.status === 204) {
        Alert.alert('Uploaded', `${uiKind.label} updated.`);
        refresh();
      } else {
        Alert.alert(`Error ${uploadResponse?.status ?? ''}`, 'Upload failed.');
      }
    } finally {
      setActiveUploadKind(null);
    }
  };

  // Category thumbnails swap via the shared helper (same flow used by GuessPathScreen
  // pencil + create-with-thumbnail). Old local cache file purged before the PATCH
  // so a failed update does not leave stale bytes for the new imageId.
  const swapCategoryThumbnail = async (category) => {
    if (!category?.id) {
      return;
    }
    setActiveUploadKind('category-thumbnail');
    try {
      const uploaded = await uploadCategoryThumbnail({ context: authContext, groupId });
      if (!uploaded) {
        return;
      }
      if (category.thumbnail_image_id) {
        deleteCategoryThumbnailFile(groupId, category.thumbnail_image_id);
      }
      const updateResponse = await updateGroupCategory(authContext, groupId, category.id, {
        thumbnailImageId: uploaded.imageId,
      });
      if (updateResponse?.status === 200 || updateResponse?.status === 204) {
        await loadCategories();
        Alert.alert('Uploaded', 'Category thumbnail updated.');
        refresh();
      } else {
        Alert.alert(`Error ${updateResponse?.status ?? ''}`, 'Could not update category.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not update thumbnail.');
    } finally {
      setActiveUploadKind(null);
    }
  };

  const addCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      return;
    }
    const response = await createGroupCategory(authContext, groupId, { name: trimmed });
    if (response?.status === 200 || response?.status === 201) {
      setNewCategoryName('');
      await loadCategories();
    } else {
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not add category.');
    }
  };

  const saveCategory = async (category) => {
    const nextName = categoryDrafts[category.id]?.trim();
    if (!nextName || nextName === category.name) {
      return;
    }

    const response = await updateGroupCategory(authContext, groupId, category.id, { name: nextName });
    if (response?.status === 200 || response?.status === 204) {
      await loadCategories();
    } else {
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not update category.');
    }
  };

  const removeCategory = async (category) => {
    Alert.alert(
      'Delete category?',
      `"${category.name}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteGroupCategory(authContext, groupId, category.id);
            if (response?.status === 200 || response?.status === 204) {
              await loadCategories();
            } else {
              Alert.alert(`Error ${response?.status ?? ''}`, 'Could not delete category.');
            }
          },
        },
      ],
    );
  };

  return (
    <FlatList
      style={styles.scroll}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <>
          <View style={styles.section}>
            <Text style={styles.title}>Members</Text>
            <BigButton
              text="Manage members"
              onPress={() => navigation.navigate('MemberManagementScreen')}
              testID="group-settings.button.members"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>Group name</Text>
            <TextInput
              accessibilityLabel="Group name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              testID="group-settings.input.name"
            />
            <ColorPalettePicker
              label="Primary color"
              value={primaryColor}
              onValueChange={setPrimaryColor}
              testIDPrefix="group-settings.color-primary"
            />
            <ColorPalettePicker
              label="Secondary color"
              value={secondaryColor}
              onValueChange={setSecondaryColor}
              testIDPrefix="group-settings.color-secondary"
            />
            <BigButton
              text={isSavingSettings ? 'Saving...' : 'Save'}
              onPress={saveSettings}
              testID="group-settings.button.save-colors"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>UI images</Text>
            {UI_KINDS.map((entry) => (
              <View key={entry.kind} style={styles.row}>
                <BigButton
                  text={activeUploadKind === entry.kind ? 'Uploading...' : entry.label}
                  onPress={() => pickAndUpload(entry)}
                  testID={`group-settings.uploader.${entry.kind}`}
                />
              </View>
            ))}
          </View>
        </>
      )}
      data={[]}
      keyExtractor={(item) => String(item.id)}
      ListFooterComponent={(
        <View style={styles.section} testID="group-settings.category.editor">
          <View style={styles.categoryHeader}>
            <View style={styles.categoryHeadingText}>
              <Text style={styles.title}>Categories</Text>
              <Text style={styles.caption}>
                Players use these to sort hides and guesses.
              </Text>
            </View>
            <View style={styles.countBadge} testID="group-settings.category.count">
              <Text style={styles.countBadgeText}>{categories.length}</Text>
            </View>
          </View>

          <View style={styles.addComposer} testID="group-settings.category.add-composer">
            <View style={styles.addGlyph}>
              <Ionicons name="add" size={18} color="#fff" />
            </View>
            <TextInput
              accessibilityLabel="New category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="New category name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.addInput}
              testID="group-settings.category.add-input"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add category"
              onPress={addCategory}
              testID="group-settings.category.add"
              style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={styles.addChipText}>Add</Text>
            </Pressable>
          </View>

          {categoriesLoading && <Text style={styles.muted}>Loading categories…</Text>}

          {categoriesError && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>Couldn't load categories.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try loading categories again"
                onPress={loadCategories}
                testID="group-settings.category.retry"
                style={({ pressed }) => [styles.retryChip, pressed && styles.pressed]}
              >
                <Text style={styles.retryChipText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {!categoriesLoading && !categoriesError && categories.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={28} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyTitle}>No categories yet</Text>
              <Text style={styles.emptyHint}>Add your first category above.</Text>
            </View>
          )}

          <View style={styles.categoryList}>
            {categories.map((item) => {
              const draft = categoryDrafts[item.id] ?? item.name ?? '';
              const savedName = (item.name ?? '').trim();
              const isDirty = draft.trim().length > 0 && draft.trim() !== savedName;
              const thumbUri = thumbnailUris[item.id];
              const initial = (draft.trim()[0] ?? savedName[0] ?? '?').toUpperCase();
              return (
                <View key={item.id} style={styles.categoryCard} testID={`group-settings.category.row.${item.id}`}>
                  <View style={styles.categoryTop}>
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Text style={styles.thumbInitial}>{initial}</Text>
                      </View>
                    )}
                    <TextInput
                      accessibilityLabel={`Category ${item.name}`}
                      value={draft}
                      onChangeText={(value) => setCategoryDrafts((current) => ({ ...current, [item.id]: value }))}
                      style={styles.categoryNameInput}
                      testID={`group-settings.category.row.${item.id}.name`}
                      placeholder="Untitled category"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.name}`}
                      onPress={() => removeCategory(item)}
                      testID={`group-settings.category.row.${item.id}.delete`}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={18} color="#E03A3A" />
                    </Pressable>
                  </View>

                  <View style={styles.categoryDivider} />

                  <View style={styles.categoryActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${item.name}`}
                      onPress={() => saveCategory(item)}
                      testID={`group-settings.category.row.${item.id}.save`}
                      disabled={!isDirty}
                      style={({ pressed }) => [
                        styles.actionChip,
                        pressed && styles.pressed,
                        !isDirty && styles.actionChipDisabled,
                      ]}
                    >
                      <Ionicons name="create-outline" size={15} color="#fff" />
                      <Text style={styles.actionChipText}>Rename</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change ${item.name} thumbnail`}
                      onPress={() => swapCategoryThumbnail(item)}
                      testID="group-settings.uploader.category-thumbnail"
                      style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
                    >
                      <Ionicons name="image-outline" size={15} color="#fff" />
                      <Text style={styles.actionChipText}>Thumbnail</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900 },
  content: { padding: 20, gap: 12 },
  section: { backgroundColor: GlobalStyle.color.primaryColor800, padding: 12, borderRadius: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 },
  input: { backgroundColor: '#fff', color: '#000', padding: 8, marginTop: 4, borderRadius: 4 },
  row: { marginVertical: 4 },
  muted: { color: '#bbb', fontSize: 14, marginTop: 8 },
  pressed: { opacity: 0.7 },

  // --- Categories section ---
  categoryHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4,
  },
  categoryHeadingText: { flex: 1, marginRight: 12 },
  caption: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  countBadge: {
    minWidth: 26, height: 26, paddingHorizontal: 8, borderRadius: 13,
    backgroundColor: GlobalStyle.color.primaryColor, alignItems: 'center', justifyContent: 'center',
    marginTop: 6,
  },
  countBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  addComposer: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8,
    backgroundColor: GlobalStyle.color.primaryColor700, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(160,118,249,0.22)',
  },
  addGlyph: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: GlobalStyle.color.primaryColor,
    alignItems: 'center', justifyContent: 'center',
  },
  addInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 6, paddingHorizontal: 4 },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GlobalStyle.color.primaryColor, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addChipText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, gap: 8,
  },
  errorText: { color: '#F37C13', fontSize: 13, flexShrink: 1 },
  retryChip: {
    borderWidth: 1, borderColor: 'rgba(160,118,249,0.4)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  retryChipText: { color: GlobalStyle.color.secondaryColor, fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  categoryList: { marginTop: 8, gap: 10 },
  categoryCard: {
    backgroundColor: GlobalStyle.color.primaryColor700, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(160,118,249,0.18)', padding: 10,
  },
  categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: GlobalStyle.color.primaryColor600 },
  thumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(160,118,249,0.18)',
    borderWidth: 1, borderColor: 'rgba(160,118,249,0.35)',
  },
  thumbInitial: { color: GlobalStyle.color.secondaryColor, fontSize: 18, fontWeight: '700' },
  categoryNameInput: {
    flex: 1, color: '#fff', fontSize: 16, fontWeight: '600',
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  iconButton: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(224,58,58,0.12)',
  },
  categoryDivider: { height: 1, backgroundColor: 'rgba(160,118,249,0.18)', marginVertical: 10 },
  categoryActions: { flexDirection: 'row', gap: 8 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(160,118,249,0.35)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(101,40,247,0.12)',
  },
  actionChipDisabled: { opacity: 0.4 },
  actionChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
