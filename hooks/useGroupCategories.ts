import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthContext } from '../store/auth-context';
import type { PrivateGroupCategory } from '../types/groups';
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
import { showPersonalizationUpsellAlert } from '../services/billing/personalizationUpsell';

type UseGroupCategoriesOptions = {
  groupId: string;
  onRefresh?: () => void | Promise<void>;
  onUpsell?: () => void;
};

export type UseGroupCategoriesResult = {
  categories: PrivateGroupCategory[];
  drafts: Record<string, string>;
  setDraft: (categoryId: string, value: string) => void;
  thumbnailUris: Record<string, string | null>;
  loading: boolean;
  // Load failures are swallowed by the store; this stays null today and is
  // kept in the contract so the view can branch without a shape change.
  error: null;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  isSwappingThumbnail: boolean;
  add: () => Promise<void>;
  save: (category: PrivateGroupCategory) => Promise<void>;
  remove: (category: PrivateGroupCategory) => void;
  swapThumbnail: (category: PrivateGroupCategory) => Promise<void>;
  reload: () => Promise<void>;
};

// Mutation responses flow through untyped .js services (axios JSON or mapped
// errors); only `status` is branched on here.
type MutationResponse = { status?: number } | null | undefined;

type MutationError = (Error & { status?: number; response?: { status?: number } }) | null | undefined;

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
 * @param groupId - active private group id
 * @param onRefresh - refresh the group hub after mutations that
 *   affect group-level data (e.g. a thumbnail swap).
 */
export function useGroupCategories({ groupId, onRefresh, onUpsell }: UseGroupCategoriesOptions): UseGroupCategoriesResult {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);

  const [categories, setCategories] = useState<PrivateGroupCategory[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [thumbnailUris, setThumbnailUris] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSwappingThumbnail, setIsSwappingThumbnail] = useState(false);

  const hasInitialLoad = useRef(true);

  const applyCategories = useCallback(
    (nextCategories: unknown) => {
      const list = (Array.isArray(nextCategories) ? nextCategories : []) as PrivateGroupCategory[];
      setCategories(list);
      setDrafts(
        list.reduce((accumulator, category) => {
          accumulator[category.id] = category.name ?? '';
          return accumulator;
        }, {} as Record<string, string>),
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
          }, {} as Record<string, string | null>),
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
        onCategories: (nextCategories: unknown) => {
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

  const setDraft = useCallback((categoryId: string, value: string) => {
    setDrafts((current) => ({ ...current, [categoryId]: value }));
  }, []);

  const alertMutationFailure = useCallback((response: MutationResponse, messageKey: string) => {
    if (response?.status === 403) {
      showPersonalizationUpsellAlert(t, onUpsell);
      return;
    }
    Alert.alert(`${t('common.error')} ${response?.status ?? ''}`, t(messageKey));
  }, [t, onUpsell]);

  const alertMutationError = useCallback((err: unknown, messageKey: string) => {
    const error = err as MutationError;
    if (error?.response?.status === 403 || error?.status === 403) {
      showPersonalizationUpsellAlert(t, onUpsell);
      return;
    }
    Alert.alert(t('common.error'), error?.message ?? t(messageKey));
  }, [t, onUpsell]);

  const addCategory = useCallback(async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const response = await createGroupCategory(authContext, groupId, { name: trimmed });
    if (response?.status === 200 || response?.status === 201) {
      setNewCategoryName('');
      await writeThrough();
    } else {
      alertMutationFailure(response, 'groups.settings.addFailed');
    }
  }, [alertMutationFailure, authContext, groupId, newCategoryName, writeThrough]);

  const saveCategory = useCallback(
    async (category: PrivateGroupCategory) => {
      const nextName = drafts[category.id]?.trim();
      if (!nextName || nextName === category.name) return;
      const response = await updateGroupCategory(authContext, groupId, category.id, {
        name: nextName,
      });
      if (response?.status === 200 || response?.status === 204) {
        await writeThrough();
      } else {
        alertMutationFailure(response, 'groups.settings.updateFailed');
      }
    },
    [alertMutationFailure, authContext, groupId, drafts, writeThrough],
  );

  const removeCategory = useCallback(
    (category: PrivateGroupCategory) => {
      Alert.alert(
        t('groups.settings.deleteTitle'),
        t('groups.settings.deleteMessage', { name: category.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              const response = await deleteGroupCategory(authContext, groupId, category.id);
              if (response?.status === 200 || response?.status === 204) {
                await writeThrough();
              } else {
                alertMutationFailure(response, 'groups.settings.deleteFailed');
              }
            },
          },
        ],
      );
    },
    [alertMutationFailure, authContext, groupId, writeThrough, t],
  );

  // Category thumbnail swap via the shared helper (same flow used by
  // GuessPathScreen). Old local cache file purged before the PATCH so a failed
  // update does not leave stale bytes for the new imageId.
  const swapThumbnail = useCallback(
    async (category: PrivateGroupCategory) => {
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
          Alert.alert(t('groups.settings.uploadedTitle'), t('groups.settings.thumbnailUpdated'));
          onRefresh?.();
        } else {
          alertMutationFailure(updateResponse, 'groups.settings.updateFailed');
        }
      } catch (err) {
        alertMutationError(err, 'groups.settings.updateThumbnailFailed');
      } finally {
        setIsSwappingThumbnail(false);
      }
    },
    [alertMutationError, alertMutationFailure, authContext, groupId, writeThrough, onRefresh, t],
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
