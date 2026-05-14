import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const E2E_HIDDEN_GUESS_CARD_KEY = 'e2eHiddenGuessCard';

export async function getLocalImages() {
  //console.log("getLocalImages");
  const imageList = await AsyncStorage.getItem("imageList");
  return imageList ? JSON.parse(imageList) : null;
};

function getLastListId(list) {
  const lastListId = list.reduce((maxId, image) => {
    const imageId = image.listId;
    return imageId > maxId ? imageId : maxId;
  }, 0);
  return lastListId
};

export async function getLastImageId() {
  console.log("getLastImageId");
  const localImageList = await AsyncStorage.getItem("imageList");
  //console.log("getLastImageId localImageList", localImageList);

  if ((localImageList !== null) && (localImageList !== "[]")) {
    const imageListObject = JSON.parse(localImageList);
    const lastListId = getLastListId(imageListObject);
    //console.log("getLastImageId lastListId", lastListId);
    return lastListId;
  };

  return 0;
};

export async function saveLastImageUuid(imageUuid) {
  await AsyncStorage.setItem("lastImageUuid", imageUuid);
  return null;
};

export async function getLastImageUuid() {
  const lastImageUuid = await AsyncStorage.getItem("lastImageUuid");
  return lastImageUuid;
};

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

async function removeFromCache(localUri) {
  await FileSystem.deleteAsync(localUri, { idempotent: true });
};

export async function emptyImageList() {
  const localList = await AsyncStorage.getItem("imageList")
  //console.log("emptyImageList imageList", localList);
  //console.log("if (localList !== null) && (localList !== '[]')", (localList !== null) && (localList !== "[]"));

  if ((localList !== null) && (localList !== "[]")) {
    JSON.parse(localList).forEach( async (image) => {
      await removeFromCache(image.imageFile)
    });
  };

  await AsyncStorage.removeItem("imageList");
  await AsyncStorage.removeItem("lastImageUuid");
};

export async function storeImageList(imageList) {
  await AsyncStorage.setItem("imageList", JSON.stringify(imageList));
};

function removeObjectById(imageListObject, listId) {
  for (let i = 0; i < imageListObject.length; i++) {
    if (imageListObject[i].listId === listId) {
      imageListObject.splice(i, 1);
      break;
    };
  };
  return imageListObject;
};

export async function updateImageList(updatedImageList) {
  const imageList = await AsyncStorage.getItem("imageList");
  const jsonImageList = JSON.parse(imageList);
  const newImageList = [...jsonImageList, ...updatedImageList];
  await AsyncStorage.setItem("imageList", JSON.stringify(newImageList));
  return newImageList;
};


export async function removeImageFromList(listId) {
  const imageList = await AsyncStorage.getItem("imageList");
  const jsonImageList = JSON.parse(imageList);
  const updatedImageList = removeObjectById(jsonImageList, listId);
  await AsyncStorage.setItem("imageList", JSON.stringify(updatedImageList));
  return null;
};

export async function deleteImageFromStorage(imageFilePath) {
  await FileSystem.deleteAsync(imageFilePath, { idempotent: true });
  const fileName = imageFilePath.substring(imageFilePath.lastIndexOf("/") + 1);
  const imagePickerUrl = FileSystem.cacheDirectory + `ImagePicker/${fileName}`;
  [imagePickerUrl, imageFilePath].map(async (item) => {
    console.log("removeCard item", item);
    await FileSystem.deleteAsync(item, { idempotent: true });
  });
  return null;
};