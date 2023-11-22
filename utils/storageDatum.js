import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { errorLog } from "./errorLog";

export async function getLocalImages(context) {
  console.log("getLocalImages");
  /*  */
  let imageList = "";
  try {
    imageList = await AsyncStorage.getItem("imageList");
  } catch (error) {
    imageList = context.imageList;
    errorLog({ functionName: "getLocalImages AsyncStorage.getItem('imageList')", error: error.message });
  };
  /*  */

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

export async function getLastImageId(context) {
  console.log("getLastImageId");
  let imageList = "";
  try {
    imageList = await AsyncStorage.getItem("imageList");
  } catch (error) {
    imageList = context.imageList;
    errorLog({ functionName: "getLastImageId", error: error.message});
  }
  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const lastListId = getLastListId(imageListObject);
    return lastListId;
  };
  return 0;
};

export async function saveLastImageUuid(context) {
  /*  */
  let imageList = "";
  try {
    imageList = await AsyncStorage.getItem("imageList");
  } catch (error) {
    imageList = context.imageList;
    errorLog({ functionName: "saveLastImageUuid", error: error.message});
  };
  /*  */

  if ((imageList !== null) && (imageList !== "[]")) {
    const imageListObject = JSON.parse(imageList);
    const lastListId = getLastListId(imageListObject);
    const lastImage = imageListObject.find(image => image.listId === lastListId);
    const lastPictureId = lastImage.pictureId;
    try {
      await AsyncStorage.setItem("lastImageUuid", lastPictureId);
    } catch (error) {
      errorLog({ functionName: "saveLastImageUuid AsyncStorage.setItem", error: error.message});
    };
    /*  */
    context.setLastImageUuid(lastPictureId);
    /*  */
    return true
  };
  return false;
};

export async function getLastImageUuid(context) {
  let lastImageUuid = "";
/*  */
  try {
    lastImageUuid = await AsyncStorage.getItem("lastImageUuid");
  } catch (error) {
    lastImageUuid = context.lastImageUuid;
    errorLog({ functionName: "getLastImageUuid AsyncStorage.getItem", error: error.message});
  };
  /*  */
  return lastImageUuid;
};

async function removeFromCache(localUri) {
  try {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  } catch (error) {
    errorLog({ functionName: "removeFromCache", error: error.message});
  };
};

export async function emptyImageList(imageList) {
  /*  */
  let localList = "";

  try {
    /*  */
    try {
      localList = await AsyncStorage.getItem("imageList");
    } catch (error) {
      errorLog({ functionName: "emptyImageList AsyncStorage.getItem('imageList')", error: error.message });
      localList = imageList;
    };
    /*  */

    if ((localList !== null) && (localList !== "[]")) {
      JSON.parse(localList).forEach( async (image) => {
        await removeFromCache(image.imageFile)
      });
    };
  } catch (error) {
    errorLog({ functionName: "emptyImageList", error: error.message });
  };

  console.log("emptyImageList imageList", localList);

  try {
    await AsyncStorage.removeItem("imageList");
  } catch (error) {
    errorLog({ functionName: "emptyImageList removeItem('imageList')", error: error.message });
  };

};

export async function storeImageList(imageList, context) {
  try {
    await AsyncStorage.setItem("imageList", JSON.stringify(imageList));
  } catch (error) {
    errorLog({ functionName: "storeImageList AsyncStorage.setItem('imageList", error: error.message });
  };
  context.setImageList(JSON.stringify(imageList));
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

export async function updateImageList(updatedImageList, context) {
  let imageList = "";
  try {
    imageList = await AsyncStorage.getItem("imageList");
  } catch (error) {
    errorLog({ functionName: "updateImageList getItem('imageList')", error: error.message });
    imageList = context.imageList;
  };

  const jsonImageList = JSON.parse(imageList);
  const newImageList = [...jsonImageList, ...updatedImageList];
  try {
    await AsyncStorage.setItem("imageList", JSON.stringify(newImageList));
  } catch (error) {
    errorLog({ functionName: "updateImageList AsyncStorage.setItem('imageList", error: error.message });
  }
  /*  */
  context.setImageList(JSON.stringify(newImageList));
  /*  */
  return newImageList;
};


export async function removeImageFromList(listId, context) {
  let imageList = "";
  /*  */
  try {
    imageList = await AsyncStorage.getItem("imageList");
  } catch (error) {
    errorLog({ functionName: "removeImageFromList AsyncStorage.getItem('imageList')", error: error.message });
    imageList = context.imageList;
  };
  /*  */
  const jsonImageList = JSON.parse(imageList);
  const updatedImageList = removeObjectById(jsonImageList, listId);
  /*  */
  try {
    await AsyncStorage.setItem("imageList", JSON.stringify(updatedImageList));
  } catch (error) {
    errorLog({ functionName: "removeImageFromList AsyncStorage.setItem('imageList", error: error.message });
  };
  /*  */
  /*  */
  context.setImageList(JSON.stringify(updatedImageList));
  /*  */
  // {status: ok}
  return null;
};
