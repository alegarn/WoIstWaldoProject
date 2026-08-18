import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AuthContext } from '../store/auth-context';
import {
  createGroupCategory,
  updateGroupCategory,
  deleteGroupCategory,
} from '../services/groups/groupCategoriesApi';
import {
  loadGroupCategoriesOptimistic,
  refreshGroupCategories,
} from '../services/groups/groupCategoriesStore';
import {
  deleteCategoryThumbnailFile,
  resolveCategoryThumbnail,
} from '../services/groups/groupCategoryThumbnails';
import { uploadCategoryThumbnail } from '../services/groups/categoryThumbnailUpload';

/**
 * Owns category CRUD + thumbnail management for a private group.
 *
 * Single Responsibility: the data side of categories (load / create / rename /
 * delete / swap-thumbnail). The view (GroupCategoriesSection) consumes this and
 * renders. Dependencies (auth context, group id, refresh callback) are injected,
 * so the hook is unit-testable in isolation.
 *
 * Load strategy: render from the offline cache first (optimistic), then
 * background-revalidate from the server and replace state only when the fresh
 * payload differs. Mutations write-through to the cache via the store. The store
 * already swallows network errors, so this hook never throws on load.
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

  const hasInitialLoad = useRef(true);

  const applyCategories = useCallback(
    (nextCategories) => {
      const list = Array.isArray(nextCategories) ? nextCategories : [];
      setCategories(list);
      setDrafts(
        list.reduce((accumulator, category) => {
          accumulator[category.id] = category.name ?? '';
          return accumulator;
        }, {}),
      );
      // Resolve display URIs the same way GuessPathScreen does: local cache hit
      // when available, otherwise fetch + cache (handles backend-storage auth and
      // S3 presigned URLs uniformly). Falls back to null -> initial swatch.
      // Runs on both the optimistic and the fresh payload so the locally-cached
      // file uri can enrich/override the base thumbnailUrl set by the store's
      // normalizePrivateCategory. Fire-and-forget.
      Promise.all(
        list.map((category) => (
          category?.thumbnail_image_id
            ? resolveCategoryThumbnail(authContext, { groupId, category })
            : Promise.resolve(null)
        )),
      ).then((resolved) => {
        setThumbnailUris(
          list.reduce((accumulator, category, index) => {
            accumulator[category.id] = resolved[index];
            return accumulator;
          }, {}),
        );
      });
    },
    [authContext, groupId],
  );

  const loadCategories = useCallback(async () => {
    if (!groupId) return;
    if (hasInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      await loadGroupCategoriesOptimistic({
        context: authContext,
        groupId,
        onCategories: (nextCategories) => {
          applyCategories(nextCategories);
          hasInitialLoad.current = false;
        },
      });
    } catch {
      // store already swallows network errors; never propagate to caller
    } finally {
      setLoading(false);
    }
  }, [authContext, groupId, applyCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Write-through after a successful mutation: pull fresh server state, persist
  // to cache, then update local state from { data }. Returns the store result so
  // callers can detect { isError } if needed.
  const writeThrough = useCallback(async () => {
    const result = await refreshGroupCategories({ context: authContext, groupId });
    if (result?.data) {
      applyCategories(result.data);
    }
    return result;
  }, [authContext, groupId, applyCategories]);

  const setDraft = useCallback((categoryId, value) => {
    setDrafts((current) => ({ ...current, [categoryId]: value }));
  }, []);

  const addCategory = useCallback(async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const response = await createGroupCategory(authContext, groupId, { name: trimmed });
    if (response?.status === 200 || response?.status === 201) {
      setNewCategoryName('');
      await writeThrough();
    } else {
      Alert.alert(`Error ${response?.status ?? ''}`, 'Could not add category.');
    }
  }, [authContext, groupId, newCategoryName, writeThrough]);

  const saveCategory = useCallback(
    async (category) => {
      const nextName = drafts[category.id]?.trim();
      if (!nextName || nextName === category.name) return;
      const response = await updateGroupCategory(authContext, groupId, category.id, {
        name: nextName,
      });
      if (response?.status === 200 || response?.status === 204) {
        await writeThrough();
      } else {
        Alert.alert(`Error ${response?.status ?? ''}`, 'Could not update category.');
      }
    },
    [authContext, groupId, drafts, writeThrough],
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
                await writeThrough();
              } else {
                Alert.alert(`Error ${response?.status ?? ''}`, 'Could not delete category.');
              }
            },
          },
        ],
      );
    },
    [authContext, groupId, writeThrough],
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
          await writeThrough();
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
    [authContext, groupId, writeThrough, onRefresh],
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
