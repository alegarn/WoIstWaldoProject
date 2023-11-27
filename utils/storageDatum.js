import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

export async function getLocalImages() {
  console.log("getLocalImages");
  const imageList = await AsyncStorage.getItem("imageList");
  console.log("getLocalImages localImageList", imageList);
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
  const imageList = await AsyncStorage.getItem("imageList");
  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const lastListId = getLastListId(imageListObject);
    return lastListId;
  };
  return 0;
};

export async function saveLastImageUuid() {
  const imageList = await AsyncStorage.getItem("imageList");
  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const lastListId = getLastListId(imageListObject);
    const lastImage = imageListObject.find(image => image.listId === lastListId);
    const lastPictureId = lastImage.pictureId;
    await AsyncStorage.setItem("lastImageUuid", lastPictureId);
    return true
  };
  return false;
};

export async function getLastImageUuid() {
  const lastImageUuid = await AsyncStorage.getItem("lastImageUuid");
  return lastImageUuid;
};

async function removeFromCache(localUri) {
  await FileSystem.deleteAsync(localUri, { idempotent: true });
};

export async function emptyImageList() {
  const localList = await AsyncStorage.getItem("imageList")
  console.log("emptyImageList imageList", localList);

  console.log("if (localList !== null) && (localList !== '[]')", (localList !== null) && (localList !== "[]"));

  if ((localList !== null) && (localList !== "[]")) {
    JSON.parse(localList).forEach( async (image) => {
      await removeFromCache(image.imageFile)
    });
  };

  await AsyncStorage.removeItem("imageList");
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
  // {status: ok}
  return null;
};
