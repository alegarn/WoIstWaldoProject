import { getAllKeys, getItem, multiRemove, removeItem, setItem } from '../../utils/localStore';

interface CachedGroupCategory {
  id?: string;
  name?: string;
  key?: string;
  sort_order?: number;
  thumbnail_image_id?: string;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
}

const PREFIX = 'groupCategories';

function groupCategoryKey(groupId: string): string {
  return `${PREFIX}:${groupId}`;
}

export { groupCategoryKey };

export async function readGroupCategoryCache(groupId: string): Promise<CachedGroupCategory[] | null> {
  const stored = await getItem(groupCategoryKey(groupId));
  if (!stored) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed as CachedGroupCategory[];
}

export async function writeGroupCategoryCache(
  groupId: string,
  categories: CachedGroupCategory[] | null,
): Promise<void> {
  await setItem(
    groupCategoryKey(groupId),
    JSON.stringify(Array.isArray(categories) ? categories : []),
  );
}

export async function clearGroupCategoryCache(groupId: string): Promise<void> {
  await removeItem(groupCategoryKey(groupId));
}

export async function clearAllGroupCategoryCaches(): Promise<void> {
  const keys = await getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:`));

  if (target.length > 0) {
    await multiRemove(target);
  }
}
