import { useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import BigButton from '../../components/UI/BigButton';
import Button from '../../components/UI/Button';
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
import { deleteCategoryThumbnailFile } from '../../services/groups/groupCategoryThumbnails';
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
  const { data, refresh } = useGroupsHub();

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
    } else {
      setCategoriesError(response?.data ?? 'Could not load categories.');
    }
  }, [authContext, groupId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!groupId || isOwner) {
      return;
    }
    navigation.replace('GroupsListScreen');
  }, [groupId, isOwner, navigation]);

  if (!groupId || !isOwner) {
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
          <Text style={styles.title}>Categories</Text>
          {categoriesLoading && <Text style={styles.muted}>Loading categories...</Text>}
          {categoriesError && <Text style={styles.muted}>Could not load categories.</Text>}
          <View style={styles.addRow}>
            <TextInput
              accessibilityLabel="New category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="New category"
              style={styles.input}
            />
            <BigButton
              text="Add"
              onPress={addCategory}
              testID="group-settings.category.add"
            />
          </View>
          {categories.map((item) => (
            <View key={item.id} style={styles.categoryRow} testID={`group-settings.category.row.${item.id}`}>
              <View style={styles.categoryLabel}>
                <TextInput
                  accessibilityLabel={`Category ${item.name}`}
                  value={categoryDrafts[item.id] ?? item.name}
                  onChangeText={(value) => setCategoryDrafts((current) => ({ ...current, [item.id]: value }))}
                  style={styles.input}
                  testID={`group-settings.category.row.${item.id}.name`}
                />
              </View>
              <Button
                onPress={() => saveCategory(item)}
                testID={`group-settings.category.row.${item.id}.save`}
              >
                Save
              </Button>
              <Button
                onPress={() => swapCategoryThumbnail(item)}
                testID="group-settings.uploader.category-thumbnail"
              >
                Thumb
              </Button>
              <Button
                cancel
                onPress={() => removeCategory(item)}
                testID={`group-settings.category.row.${item.id}.delete`}
              >
                Delete
              </Button>
            </View>
          ))}
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
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: GlobalStyle.color.primaryColor800, borderRadius: 6, marginVertical: 4 },
  categoryLabel: { flex: 1 },
  categoryText: { color: '#fff', fontSize: 16 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  muted: { color: '#bbb', fontSize: 14 },
});
