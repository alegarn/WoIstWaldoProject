import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";

const E2E_HIDDEN_GUESS_CARD_KEY = 'e2eHiddenGuessCard';
const SESSION_LANGUAGE_FILTER_KEY = 'sessionLanguageFilter';
const PREFERRED_LANGUAGE_KEY = 'preferredLanguage';
const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
const USER_TAGS_KEY = 'userTags';
const DEFAULT_LANGUAGE = 'en';

function imageListKey(categoryKey, language) {
  return `imageList:${categoryKey || 'all'}:${language || 'any'}`;
};

function lastImageUuidKey(categoryKey, language) {
  return `lastImageUuid:${categoryKey || 'all'}:${language || 'any'}`;
};

export async function getLocalImages(categoryKey, language) {
  const stored = await AsyncStorage.getItem(imageListKey(categoryKey, language));
  if (!stored) {
    return null;
  }

  let images;
  try {
    images = JSON.parse(stored);
  } catch {
    return null;
  }

  if (!Array.isArray(images)) {
    return null;
  }

  // Cache (Paths.cache) is not durable across restarts/updates, but this list is.
  // Drop entries whose image file is gone and persist the trimmed list so dead
  // uris don't linger and render as blank cards.
  const viable = images.filter((image) => localImageFileExists(image?.imageFile));

  if (viable.length !== images.length) {
    await AsyncStorage.setItem(imageListKey(categoryKey, language), JSON.stringify(viable));
  }

  return viable;
};

/**
 * Resolve the next playable card from the persisted deck.
 * Reuses getLocalImages (already drops non-viable/local-missing files). The deck
 * is ordered ascending by listId (see getLastImageId / getLastListId).
 * - currentListId is a finite number → first item whose listId is strictly greater.
 * - otherwise (undefined/null/NaN) → first item of the deck.
 * Returns null when the deck is missing or empty.
 */
export async function getNextImage(categoryKey, language, currentListId) {
  const images = await getLocalImages(categoryKey, language);
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  if (Number.isFinite(currentListId)) {
    return images.find((image) => image?.listId > currentListId) ?? null;
  }

  return images[0];
};

function getLastListId(list) {
  const lastListId = list.reduce((maxId, image) => {
    const imageId = image.listId;
    return imageId > maxId ? imageId : maxId;
  }, 0);
  return lastListId
};

export async function getLastImageId(categoryKey, language) {
  console.log("getLastImageId");
  const localImageList = await AsyncStorage.getItem(imageListKey(categoryKey, language));
  //console.log("getLastImageId localImageList", localImageList);

  if ((localImageList !== null) && (localImageList !== "[]")) {
    const imageListObject = JSON.parse(localImageList);
    const lastListId = getLastListId(imageListObject);
    //console.log("getLastImageId lastListId", lastListId);
    return lastListId;
  };

  return 0;
};

export async function saveLastImageUuid(imageUuid, categoryKey, language) {
  await AsyncStorage.setItem(lastImageUuidKey(categoryKey, language), imageUuid);
  return null;
};

export async function getLastImageUuid(categoryKey, language) {
  const lastImageUuid = await AsyncStorage.getItem(lastImageUuidKey(categoryKey, language));
  return lastImageUuid;
};

export async function getSessionLanguageFilter() {
  const stored = await AsyncStorage.getItem(SESSION_LANGUAGE_FILTER_KEY);
  return stored || DEFAULT_LANGUAGE;
};

export async function saveSessionLanguageFilter(code) {
  await AsyncStorage.setItem(SESSION_LANGUAGE_FILTER_KEY, code);
  return null;
};

export async function getPreferredLanguage() {
  const stored = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
  return stored || null;
};

export async function savePreferredLanguage(code) {
  await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, code);
  return null;
};

export async function getOnboardingCompleted() {
  const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  return stored === 'true';
}

export async function setOnboardingCompleted(value) {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, value ? 'true' : 'false');
  return null;
}

function normalizeTagName(name) {
  return String(name || '').trim().toLowerCase();
}

function parseStoredValue(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function normalizeStoredTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeTagName).filter(Boolean))];
}

export async function getUserTags() {
  const storedTags = await AsyncStorage.getItem(USER_TAGS_KEY);
  return normalizeStoredTags(parseStoredValue(storedTags));
}

export async function saveUserTag(name) {
  const normalizedName = normalizeTagName(name);
  const currentTags = await getUserTags();

  if (!normalizedName) {
    return currentTags;
  }

  const nextTags = currentTags.includes(normalizedName)
    ? currentTags
    : [...currentTags, normalizedName];

  await AsyncStorage.setItem(USER_TAGS_KEY, JSON.stringify(nextTags));
  return nextTags;
}

export async function saveE2EHiddenGuessCard(payload) {
  await AsyncStorage.setItem(E2E_HIDDEN_GUESS_CARD_KEY, JSON.stringify(payload));
  return null;
}

export async function getE2EHiddenGuessCard() {
  const storedPayload = await AsyncStorage.getItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return parseStoredValue(storedPayload);
}

export async function clearE2EHiddenGuessCard() {
  await AsyncStorage.removeItem(E2E_HIDDEN_GUESS_CARD_KEY);
  return null;
}

function deleteFileIfPresent(file) {
  if (file?.exists) {
    file.delete();
  }
}

function localImageFileExists(uri) {
  try {
    return !!new File(uri).exists;
  } catch {
    return false;
  }
}

async function removeFromCache(localUri) {
  if (!localUri) {
    return;
  }

  deleteFileIfPresent(new File(localUri));
};

export async function emptyImageList(categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const localList = await AsyncStorage.getItem(listKey)
  //console.log("emptyImageList imageList", localList);
  //console.log("if (localList !== null) && (localList !== '[]')", (localList !== null) && (localList !== "[]"));

  if ((localList !== null) && (localList !== "[]")) {
    JSON.parse(localList).forEach( async (image) => {
      await removeFromCache(image.imageFile)
    });
  };

  await AsyncStorage.removeItem(listKey);
  await AsyncStorage.removeItem(lastImageUuidKey(categoryKey, language));
};

export async function storeImageList(imageList, categoryKey, language) {
  await AsyncStorage.setItem(imageListKey(categoryKey, language), JSON.stringify(imageList));
};

function removeObjectById(imageListObject, listId) {
  if (!Array.isArray(imageListObject)) return imageListObject;
  for (let i = 0; i < imageListObject.length; i++) {
    if (imageListObject[i].listId === listId) {
      imageListObject.splice(i, 1);
      break;
    };
  };
  return imageListObject;
};

export async function updateImageList(updatedImageList, categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const imageList = await AsyncStorage.getItem(listKey);
  const jsonImageList = imageList ? JSON.parse(imageList) : [];
  const newImageList = [...jsonImageList, ...updatedImageList];
  await AsyncStorage.setItem(listKey, JSON.stringify(newImageList));
  return newImageList;
};


export async function removeImageFromList(listId, categoryKey, language) {
  const listKey = imageListKey(categoryKey, language);
  const imageList = await AsyncStorage.getItem(listKey);
  if (imageList === null || imageList === undefined) {
    return null;
  };
  const jsonImageList = JSON.parse(imageList);
  const updatedImageList = removeObjectById(jsonImageList, listId);
  await AsyncStorage.setItem(listKey, JSON.stringify(updatedImageList));
  return null;
};

export async function deleteImageFromStorage(imageFilePath) {
  if (!imageFilePath) {
    return null;
  }

  deleteFileIfPresent(new File(imageFilePath));
  const fileName = imageFilePath.substring(imageFilePath.lastIndexOf("/") + 1);
  deleteFileIfPresent(new File(Paths.cache, `ImagePicker/${fileName}`));
  return null;
};