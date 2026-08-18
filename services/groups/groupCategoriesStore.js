import { listGroupCategories } from './groupCategoriesApi';
import {
  readGroupCategoryCache,
  writeGroupCategoryCache,
} from './groupCategoryCache';

export function normalizePrivateCategory(category) {
  if (!category || typeof category !== 'object') {
    return category;
  }

  return {
    ...category,
    key: category?.key ?? category?.id,
    thumbnailUrl: category?.thumbnailUrl ?? category?.thumbnail_url ?? null,
  };
}

function toSignatureEntry(category) {
  return {
    id: category?.id,
    name: category?.name,
    sort_order: category?.sort_order,
    thumbnail_image_id: category?.thumbnail_image_id,
  };
}

export function categoryListSignature(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const entries = list.map(toSignatureEntry);
  entries.sort((a, b) => {
    const aId = a?.id;
    const bId = b?.id;
    if (aId === bId) return 0;
    if (aId === null || aId === undefined) return -1;
    if (bId === null || bId === undefined) return 1;
    return aId < bId ? -1 : 1;
  });

  return JSON.stringify(entries);
}

export async function loadGroupCategoriesOptimistic({ context, groupId, onCategories }) {
  let cached = null;

  try {
    cached = await readGroupCategoryCache(groupId);
  } catch {
    // best-effort: treat unreadable cache as no cache
  }

  let lastCached = cached;

  if (Array.isArray(cached) && typeof onCategories === 'function') {
    onCategories(cached);
  }

  try {
    const resp = await listGroupCategories(context, groupId);
    if (resp?.status === 200) {
      const fresh = (resp.data ?? []).map(normalizePrivateCategory);

      if (categoryListSignature(fresh) !== categoryListSignature(lastCached)) {
        await writeGroupCategoryCache(groupId, fresh);
        lastCached = fresh;
        if (typeof onCategories === 'function') {
          onCategories(fresh);
        }
      }
    }
  } catch {
    // best-effort: cached state stays as-is
  }
}

export async function refreshGroupCategories({ context, groupId }) {
  try {
    const resp = await listGroupCategories(context, groupId);
    if (resp?.status === 200) {
      const fresh = (resp.data ?? []).map(normalizePrivateCategory);
      await writeGroupCategoryCache(groupId, fresh);

      return { data: fresh };
    }

    return { isError: true, status: resp?.status };
  } catch {
    return { isError: true };
  }
}
