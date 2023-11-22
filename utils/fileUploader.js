/* https://snack.expo.dev/@rudiahmad/react-native-expo-how-to-upload-file-or-image-using-form-data-php */
/* https://docs.expo.dev/versions/latest/sdk/imagepicker/ */
/* https://github.com/expo/examples/tree/master/with-aws-storage-upload */

import * as FileSystem from "expo-file-system";
import { handleContentLength } from "./imageInfos";
import { getUploadUrl, saveImageInfos, saveImageToAws } from "./imagesRequests";
import * as SecureStore from 'expo-secure-store';


async function handleGetUploadUrl({context}) {

  const response = await getUploadUrl();

  return { status: response.status, title: response.title, message: response.message, data: response.data };
};




const exportImage = async ({url, filename, uri, fileExtension, contentLength, userId}) => {
  console.log("exportImage");
  const isSaved = await saveImageToAws({
    url: url,
    filename: filename,
    userId: userId,
    fileUrl: uri,
    fileExtension: fileExtension,
    contentLength: contentLength
  });
  return isSaved;
};

const exportPictureData = async ({ imagesInfos, context }) => {
  const saveImageResponse = saveImageInfos({
    userId: await SecureStore.getItemAsync("userId"),
    imagesInfos: {
      user_id: imagesInfos.userId,
      name: imagesInfos.name,
      file_extension: imagesInfos.fileExtension,
      image_height: imagesInfos.imageHeight,
      image_width: imagesInfos.imageWidth,
      screen_height: imagesInfos.screenHeight,
      screen_width: imagesInfos.screenWidth,
      description: imagesInfos.description,
      is_portrait: imagesInfos.isPortrait,
      x_location: imagesInfos.xLocation,
      y_location: imagesInfos.yLocation,
      storage_url: imagesInfos.storageUrl,

      /* file_type, file_size */
    },
    token: context.token,
    uid: context.uid,
    expiry: context.expiry,
    access_token: context.access_token,
    client: context.client
  });

  return saveImageResponse
};


export async function imageUploader({ imageInfos, context }) {
  const imageLocalUri = imageInfos.uri;
  const contentLength = await handleContentLength(imageLocalUri);
  const uploadUrlData = await handleGetUploadUrl({ context });

  if (uploadUrlData.status !== 200) {
    return uploadUrlData;
  };

  const userId = await SecureStore.getItemAsync("userId");

  const exportImageData = await exportImage({
    url: uploadUrlData.data.url,
    filename: uploadUrlData.data.filename,
    uri: imageInfos.uri,
    fileExtension: imageInfos.fileExtension,
    contentLength,
    userId: userId,
  });

  if (exportImageData.status !== 200) {
    return exportImageData;
  };

  const imageInfosSaved = await exportPictureData({
    imagesInfos: {
      userId: userId,
      name: uploadUrlData.data.filename,
      fileExtension: imageInfos.fileExtension,
      imageHeight: imageInfos.imageHeight,
      imageWidth: imageInfos.imageWidth,
      screenHeight: imageInfos.screenHeight,
      screenWidth: imageInfos.screenWidth,
      description: imageInfos.description,
      isPortrait: imageInfos.isPortrait,
      xLocation: imageInfos.xLocation,
      yLocation: imageInfos.yLocation,
      storageUrl: "",
    },
    context: context
  });
  console.log("imageInfosSaved", imageInfosSaved);
  if (imageInfosSaved.status !== 200) {
    return imageInfosSaved;
  };

  FileSystem.deleteAsync(imageLocalUri);

  /* delete */

  return { status: 200 };
};
