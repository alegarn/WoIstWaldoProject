import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'groupCategories';

function groupCategoryKey(groupId) {
  return `${PREFIX}:${groupId}`;
}

export { groupCategoryKey };

export async function readGroupCategoryCache(groupId) {
  const stored = await AsyncStorage.getItem(groupCategoryKey(groupId));
  if (!stored) {
    return null;
  }

  let categories;
  try {
    categories = JSON.parse(stored);
  } catch {
    return null;
  }

  if (!Array.isArray(categories)) {
    return null;
  }

  return categories;
}

export async function writeGroupCategoryCache(groupId, categories) {
  await AsyncStorage.setItem(
    groupCategoryKey(groupId),
    JSON.stringify(Array.isArray(categories) ? categories : []),
  );
}

export async function clearGroupCategoryCache(groupId) {
  await AsyncStorage.removeItem(groupCategoryKey(groupId));
}

export async function clearAllGroupCategoryCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(`${PREFIX}:`));

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}
