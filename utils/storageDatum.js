import AsyncStorage from "@react-native-async-storage/async-storage";


export async function getLocalImages() {
  console.log("getLocalImages");
  const imageList = await AsyncStorage.getItem("imageList");
  return imageList ? JSON.parse(imageList) : null;
};

export async function getLastImageId() {
  console.log("getLastImageId");
  const imageList = await AsyncStorage.getItem("imageList");
  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const largestId = imageListObject.reduce((maxId, image) => {
      const imageId = image.listId;
      return imageId > maxId ? imageId : maxId;
    }, 0);
    return largestId;
  };
  return 0;
};

export async function emptyImageList() {
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


export async function updateImageList(listId) {
  const imageList = await AsyncStorage.getItem("imageList");
  const jsonImageList = JSON.parse(imageList);
  const updatedImageList = removeObjectById(jsonImageList, listId);
  await AsyncStorage.setItem("imageList", JSON.stringify(updatedImageList));
  return null;
};
