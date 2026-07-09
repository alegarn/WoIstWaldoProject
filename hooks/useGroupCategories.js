import { useCallback, useContext, useEffect, useState } from 'react';

import { AuthContext } from '../store/auth-context';
import {
  listGroupCategories,
  createGroupCategory,
  updateGroupCategory,
  deleteGroupCategory,
} from '../services/groups/groupCategoriesApi';
import {
  deleteCategoryThumbnailFile,
  resolveCategoryThumbnail,
} from '../services/groups/groupCategoryThumbnails';
import { uploadCategoryThumbnail } from '../services/groups/categoryThumbnailUpload';
import { Alert } from 'react-native';

/**
 * Owns category CRUD + thumbnail management for a private group.
 *
 * Single Responsibility: the data side of categories (load / create / rename /
 * delete / swap-thumbnail). The view (GroupCategoriesSection) consumes this and
 * renders. Dependencies (auth context, group id, refresh callback) are injected,
 * so the hook is unit-testable in isolation.
 *
 * @param {string} groupId - active private group id
 * @param {() => void} onRefresh - refresh the group hub after mutations that
 *   affect group-level data (e.g. a thumbnail swap).
 */
export function useGroupCategories({ groupId, onRefresh }) {
  const authContext = useContext(AuthContext);

  const [categories, setCategories] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [thumbnailUris, setThumbnailUris] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSwappingThumbnail, setIsSwappingThumbnail] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    const response = await listGroupCategories(authContext, groupId);
    setLoading(false);
    if (response?.status === 200) {
      const nextCategories = response.data ?? [];
      setCategories(nextCategories);
      setDrafts(
        nextCategories.reduce((accumulator, category) => {
          accumulator[category.id] = category.name ?? '';
          return accumulator;
        }, {}),
      );
      // Resolve display URIs the same way GuessPathScreen does: local cache hit
      // when available, otherwise fetch + cache (handles backend-storage auth and
      // S3 presigned URLs uniformly). Falls back to null -> initial swatch.
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
      setError(response?.data ?? 'Could not load categories.');
    }
  }, [authContext, groupId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const setDraft = useCallback((categoryId, value) => {
    setDrafts((current) => ({ ...current, [categoryId]: value }));
  }, []);

  const addCategory = useCallback(async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const response = await createGroupCategory(authContext, groupId, { name: trimmed });
    if (response?.status === 200 || response?.status === 201) {
      setNewCategoryName('');
      await loadCategories();
    } else {
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not add category.');
    }
  }, [authContext, groupId, newCategoryName, loadCategories]);

  const saveCategory = useCallback(
    async (category) => {
      const nextName = drafts[category.id]?.trim();
      if (!nextName || nextName === category.name) return;
      const response = await updateGroupCategory(authContext, groupId, category.id, {
        name: nextName,
      });
      if (response?.status === 200 || response?.status === 204) {
        await loadCategories();
      } else {
        Alert.alert(`Error ${response?.status ?? ''}`, 'Could not update category.');
      }
    },
    [authContext, groupId, drafts, loadCategories],
  );

  const removeCategory = useCallback(
    (category) => {
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
    },
    [authContext, groupId, loadCategories],
  );

  // Category thumbnail swap via the shared helper (same flow used by
  // GuessPathScreen). Old local cache file purged before the PATCH so a failed
  // update does not leave stale bytes for the new imageId.
  const swapThumbnail = useCallback(
    async (category) => {
      if (!category?.id) return;
      setIsSwappingThumbnail(true);
      try {
        const uploaded = await uploadCategoryThumbnail({ context: authContext, groupId });
        if (!uploaded) return;
        if (category.thumbnail_image_id) {
          deleteCategoryThumbnailFile(groupId, category.thumbnail_image_id);
        }
        const updateResponse = await updateGroupCategory(authContext, groupId, category.id, {
          thumbnailImageId: uploaded.imageId,
        });
        if (updateResponse?.status === 200 || updateResponse?.status === 204) {
          await loadCategories();
          Alert.alert('Uploaded', 'Category thumbnail updated.');
          onRefresh?.();
        } else {
          Alert.alert(`Error ${updateResponse?.status ?? ''}`, 'Could not update category.');
        }
      } catch (err) {
        Alert.alert('Error', err?.message ?? 'Could not update thumbnail.');
      } finally {
        setIsSwappingThumbnail(false);
      }
    },
    [authContext, groupId, loadCategories, onRefresh],
  );

  return {
    categories,
    drafts,
    setDraft,
    thumbnailUris,
    loading,
    error,
    newCategoryName,
    setNewCategoryName,
    isSwappingThumbnail,
    add: addCategory,
    save: saveCategory,
    remove: removeCategory,
    swapThumbnail,
    reload: loadCategories,
  };
}
