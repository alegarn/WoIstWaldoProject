import AsyncStorage from "@react-native-async-storage/async-storage";


export async function getLocalImages() {
  const imageList = await AsyncStorage.getItem("imageList");
  return imageList ? JSON.parse(imageList) : null;
};

export async function getLastImageId() {
  console.log("getLastImageId", getLastImageId);
  const imageList = await AsyncStorage.getItem("imageList");
  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const id = imageListObject.last.listId;
    return id;
  };
  return 0
};

export async function emptyImageList() {
  await AsyncStorage.removeItem("imageList");
};

export async function storeImageList(imageList) {
  await AsyncStorage.setItem("imageList", JSON.stringify(imageList));
};

export async function updateImageList(pictureId) {
  const imageList = await AsyncStorage.getItem("imageList");
  const updatedImageList = JSON.parse(imageList).filter((item) => item.pictureId !== pictureId);
  await AsyncStorage.setItem("imageList", JSON.stringify(updatedImageList));
};
